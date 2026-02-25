import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RESOURCE_ORDER } from "@/game/config";
import {
	LAB_ORDER,
	MAX_RESEARCH_LEVEL,
	RESEARCH_ORDER,
} from "@/game/research-config";
import { advanceResearch } from "@/game/research-logic";
import {
	deserializeGameState,
	type SerializedGameState,
	serializeGameState,
} from "@/game/state/serialization";
import type {
	GameState,
	LabId,
	ResearchId,
	ResourceId,
	ShopBoostId,
} from "@/game/types";
import type { SerializedBigNum } from "@/lib/big-number";
import { logger } from "./logger";
import { buildSyncSnapshot, checkPlausibility } from "./plausibility";
import {
	getSyncSnapshot,
	loadStoredGameState,
	type StoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "./redis";
import { COOKIE_NAME, incrementWarnings, validateSession } from "./session";

const VALID_RESOURCE_IDS: ReadonlySet<string> = new Set<string>([
	"iron-ore",
	"plates",
	"reinforced-plate",
	"modular-frame",
	"heavy-modular-frame",
	"fused-modular-frame",
	"pressure-conversion-cube",
	"nuclear-pasta",
]);

const VALID_BOOST_IDS: ReadonlySet<string> = new Set<string>([
	"production-20x",
	"automation-2x",
	"runtime-50",
	"research-2x",
]);

const VALID_LAB_IDS: ReadonlySet<string> = new Set<string>(LAB_ORDER);

const VALID_RESEARCH_IDS: ReadonlySet<string> = new Set<string>(RESEARCH_ORDER);

// --- Types ---

type ResourceActionBody = {
	resourceId: ResourceId;
	serverVersion: number;
};

type BoostActionBody = {
	boostId: ShopBoostId;
	serverVersion: number;
};

type SaveActionBody = {
	state: SerializedGameState;
	serverVersion: number;
};

// --- Validation helpers ---

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isValidResourceId = (value: unknown): value is ResourceId => {
	return typeof value === "string" && VALID_RESOURCE_IDS.has(value);
};

const isValidBoostId = (value: unknown): value is ShopBoostId => {
	return typeof value === "string" && VALID_BOOST_IDS.has(value);
};

const isValidLabId = (value: unknown): value is LabId => {
	return typeof value === "string" && VALID_LAB_IDS.has(value);
};

const isValidResearchId = (value: unknown): value is ResearchId => {
	return typeof value === "string" && VALID_RESEARCH_IDS.has(value);
};

const isNonNegativeInteger = (value: unknown): value is number => {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
};

const isValidSerializedBigNum = (value: unknown): value is SerializedBigNum => {
	if (!isRecord(value)) {
		return false;
	}
	if (typeof value.m !== "number" || typeof value.e !== "number") {
		return false;
	}
	if (value.m === 0 && value.e === 0) {
		return true;
	}
	if (value.m < 1 || value.m >= 10) {
		return false;
	}
	if (!Number.isFinite(value.e) || !Number.isInteger(value.e)) {
		return false;
	}
	if (value.e < 0 || value.e > 1000) {
		return false;
	}
	return true;
};

const validateSerializedResource = ({
	resource,
	expectedId,
}: {
	resource: Record<string, unknown>;
	expectedId: string;
}): string | null => {
	if (resource.id !== expectedId) {
		return `Resource id mismatch: expected ${expectedId}`;
	}
	if (!isValidSerializedBigNum(resource.amount)) {
		return `Invalid amount for ${expectedId}`;
	}
	if (!isNonNegativeInteger(resource.producers)) {
		return `Invalid producers for ${expectedId}`;
	}
	if (typeof resource.isUnlocked !== "boolean") {
		return `Invalid isUnlocked for ${expectedId}`;
	}
	if (typeof resource.isAutomated !== "boolean") {
		return `Invalid isAutomated for ${expectedId}`;
	}
	if (
		resource.isPaused !== undefined &&
		typeof resource.isPaused !== "boolean"
	) {
		return `Invalid isPaused for ${expectedId}`;
	}
	if (
		resource.runStartedAt !== null &&
		typeof resource.runStartedAt !== "number"
	) {
		return `Invalid runStartedAt for ${expectedId}`;
	}
	return null;
};

const validateSerializedGameState = (
	state: Record<string, unknown>,
): string | null => {
	if (typeof state.lastSavedAt !== "number") {
		return "Missing or invalid lastSavedAt";
	}
	if (typeof state.version !== "number") {
		return "Missing or invalid version";
	}
	if (!isRecord(state.resources)) {
		return "Missing or invalid resources";
	}

	for (const id of RESOURCE_ORDER) {
		const resource = (state.resources as Record<string, unknown>)[id];
		if (!resource) {
			return `Missing resource: ${id}`;
		}
		if (!isRecord(resource)) {
			return `Invalid resource shape: ${id}`;
		}
		const error = validateSerializedResource({ resource, expectedId: id });
		if (error !== null) {
			return error;
		}
	}

	if (state.shopBoosts !== undefined) {
		if (!isRecord(state.shopBoosts)) {
			return "Invalid shopBoosts";
		}
		for (const key of Object.keys(state.shopBoosts)) {
			if (!VALID_BOOST_IDS.has(key)) {
				return `Invalid boost id: ${key}`;
			}
			if (typeof state.shopBoosts[key] !== "boolean") {
				return `Invalid boost value for ${key}`;
			}
		}
	}

	if (state.labs !== undefined) {
		if (!isRecord(state.labs)) {
			return "Invalid labs";
		}
		for (const id of LAB_ORDER) {
			const lab = (state.labs as Record<string, unknown>)[id];
			if (lab !== undefined) {
				if (!isRecord(lab)) {
					return `Invalid lab shape: ${id}`;
				}
				if (typeof lab.isUnlocked !== "boolean") {
					return `Invalid isUnlocked for lab ${id}`;
				}
				if (
					lab.activeResearchId !== null &&
					!isValidResearchId(lab.activeResearchId)
				) {
					return `Invalid activeResearchId for lab ${id}`;
				}
				if (
					lab.researchStartedAt !== null &&
					typeof lab.researchStartedAt !== "number"
				) {
					return `Invalid researchStartedAt for lab ${id}`;
				}
			}
		}
	}

	if (state.research !== undefined) {
		if (!isRecord(state.research)) {
			return "Invalid research";
		}
		for (const id of RESEARCH_ORDER) {
			const level = (state.research as Record<string, unknown>)[id];
			if (level !== undefined && !isNonNegativeInteger(level)) {
				return `Invalid research level for ${id}`;
			}
			if (typeof level === "number" && level > MAX_RESEARCH_LEVEL) {
				return `Research level exceeds maximum for ${id}`;
			}
		}
	}

	return null;
};

// --- Session helpers ---

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getSessionFromRequest = async (
	request: NextRequest,
): Promise<{ sessionId: string } | NextResponse> => {
	const sessionId = request.cookies.get(COOKIE_NAME)?.value ?? null;
	if (!sessionId) {
		return NextResponse.json({ error: "No session cookie" }, { status: 401 });
	}
	if (!UUID_REGEX.test(sessionId)) {
		logger.debug({ sessionId }, "Invalid session format");
		return NextResponse.json(
			{ error: "Invalid session format" },
			{ status: 401 },
		);
	}
	const session = await validateSession(sessionId);
	if (!session) {
		logger.debug({ sessionId }, "Invalid or expired session");
		return NextResponse.json(
			{ error: "Invalid or expired session" },
			{ status: 401 },
		);
	}
	return { sessionId };
};

export const stripServerVersion = (
	stored: StoredGameState,
): SerializedGameState => ({
	resources: stored.resources,
	shopBoosts: stored.shopBoosts,
	labs: stored.labs,
	research: stored.research,
	lastSavedAt: stored.lastSavedAt,
	version: stored.version,
});

// --- Request body parsing ---

const parseResourceActionBody = async (
	request: NextRequest,
): Promise<ResourceActionBody | NextResponse> => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json(
			{ error: "Body must be an object" },
			{ status: 400 },
		);
	}

	if (!isValidResourceId(body.resourceId)) {
		return NextResponse.json({ error: "Invalid resourceId" }, { status: 400 });
	}

	if (!isNonNegativeInteger(body.serverVersion)) {
		return NextResponse.json(
			{ error: "Invalid serverVersion" },
			{ status: 400 },
		);
	}

	return { resourceId: body.resourceId, serverVersion: body.serverVersion };
};

export const parseSaveActionBody = async (
	request: NextRequest,
): Promise<SaveActionBody | NextResponse> => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json(
			{ error: "Body must be an object" },
			{ status: 400 },
		);
	}

	if (!isNonNegativeInteger(body.serverVersion)) {
		return NextResponse.json(
			{ error: "Invalid serverVersion" },
			{ status: 400 },
		);
	}

	if (!isRecord(body.state)) {
		return NextResponse.json({ error: "Invalid state" }, { status: 400 });
	}

	const stateValidation = validateSerializedGameState(body.state);
	if (stateValidation !== null) {
		return NextResponse.json({ error: stateValidation }, { status: 400 });
	}

	return {
		state: body.state as SerializedGameState,
		serverVersion: body.serverVersion,
	};
};

export const parseVersionOnlyBody = async (
	request: NextRequest,
): Promise<{ serverVersion: number } | NextResponse> => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json(
			{ error: "Body must be an object" },
			{ status: 400 },
		);
	}

	if (!isNonNegativeInteger(body.serverVersion)) {
		return NextResponse.json(
			{ error: "Invalid serverVersion" },
			{ status: 400 },
		);
	}

	return { serverVersion: body.serverVersion };
};

// --- Plausibility-checked persistence ---

export type PlausibilitySaveResult =
	| { type: "accepted"; serverVersion: number }
	| {
			type: "corrected";
			state: SerializedGameState;
			serverVersion: number;
			warning: string;
	  };

export const persistWithPlausibility = async ({
	sessionId,
	claimedState,
	newVersion,
	updateSnapshotOnClean,
}: {
	sessionId: string;
	claimedState: SerializedGameState;
	newVersion: number;
	updateSnapshotOnClean: boolean;
}): Promise<PlausibilitySaveResult> => {
	const serverNow = Date.now();
	const lastSnapshot = await getSyncSnapshot(sessionId);

	if (!lastSnapshot) {
		await saveStoredGameState({
			sessionId,
			stored: { ...claimedState, serverVersion: newVersion },
		});
		const snapshot = buildSyncSnapshot({
			state: claimedState,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });
		return { type: "accepted", serverVersion: newVersion };
	}

	const result = checkPlausibility({
		claimedState,
		lastSnapshot,
		serverNow,
	});

	if (result.corrected && result.correctedState) {
		logger.warn(
			{ sessionId, warnings: result.warnings },
			"State corrected by plausibility check",
		);
		await incrementWarnings(sessionId);

		await saveStoredGameState({
			sessionId,
			stored: { ...result.correctedState, serverVersion: newVersion },
		});
		const snapshot = buildSyncSnapshot({
			state: result.correctedState,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });
		return {
			type: "corrected",
			state: result.correctedState,
			serverVersion: newVersion,
			warning: result.warnings.join("; "),
		};
	}

	await saveStoredGameState({
		sessionId,
		stored: { ...claimedState, serverVersion: newVersion },
	});
	if (updateSnapshotOnClean) {
		const snapshot = buildSyncSnapshot({
			state: claimedState,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });
	}
	return { type: "accepted", serverVersion: newVersion };
};

// --- Snapshot metadata patch for action routes ---

export const patchSnapshotMetadata = async ({
	sessionId,
	state,
}: {
	sessionId: string;
	state: SerializedGameState;
}): Promise<void> => {
	const existing = await getSyncSnapshot(sessionId);
	if (!existing) {
		return;
	}
	const fresh = buildSyncSnapshot({ state, timestamp: 0 });
	await setSyncSnapshot({
		sessionId,
		snapshot: {
			...existing,
			...(fresh.research && { research: fresh.research }),
			...(fresh.labs && { labs: fresh.labs }),
		},
	});
};

// --- Execute action pattern ---

export const executeAction = async ({
	request,
	action,
}: {
	request: NextRequest;
	action: (args: { state: GameState; resourceId: ResourceId }) => GameState;
}): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseResourceActionBody(request);
	if (body instanceof NextResponse) {
		return body;
	}
	const { resourceId, serverVersion } = body;

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== serverVersion) {
		logger.debug(
			{
				sessionId,
				clientVersion: serverVersion,
				serverVersion: stored.serverVersion,
			},
			"Version conflict",
		);
		return NextResponse.json(
			{
				state: stripServerVersion(stored),
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const currentState = deserializeGameState(stored);
	const newState = action({ state: currentState, resourceId });

	if (newState === currentState) {
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	const newSerialized = serializeGameState(newState);
	const newStored: StoredGameState = {
		...newSerialized,
		serverVersion: stored.serverVersion + 1,
	};
	await saveStoredGameState({ sessionId, stored: newStored });
	await patchSnapshotMetadata({ sessionId, state: newSerialized });

	return NextResponse.json({
		state: newSerialized,
		serverVersion: newStored.serverVersion,
	});
};

// --- Boost action body parsing ---

const parseBoostActionBody = async (
	request: NextRequest,
): Promise<BoostActionBody | NextResponse> => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json(
			{ error: "Body must be an object" },
			{ status: 400 },
		);
	}

	if (!isValidBoostId(body.boostId)) {
		return NextResponse.json({ error: "Invalid boostId" }, { status: 400 });
	}

	if (!isNonNegativeInteger(body.serverVersion)) {
		return NextResponse.json(
			{ error: "Invalid serverVersion" },
			{ status: 400 },
		);
	}

	return { boostId: body.boostId, serverVersion: body.serverVersion };
};

// --- Execute simple action pattern (no resourceId/boostId) ---

export const executeSimpleAction = async ({
	request,
	action,
}: {
	request: NextRequest;
	action: (args: { state: GameState }) => GameState;
}): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseVersionOnlyBody(request);
	if (body instanceof NextResponse) {
		return body;
	}
	const { serverVersion } = body;

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== serverVersion) {
		logger.debug(
			{
				sessionId,
				clientVersion: serverVersion,
				serverVersion: stored.serverVersion,
			},
			"Version conflict",
		);
		return NextResponse.json(
			{
				state: stripServerVersion(stored),
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const currentState = deserializeGameState(stored);
	const newState = action({ state: currentState });

	if (newState === currentState) {
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	const newSerialized = serializeGameState(newState);
	const newStored: StoredGameState = {
		...newSerialized,
		serverVersion: stored.serverVersion + 1,
	};
	await saveStoredGameState({ sessionId, stored: newStored });
	await patchSnapshotMetadata({ sessionId, state: newSerialized });

	return NextResponse.json({
		state: newSerialized,
		serverVersion: newStored.serverVersion,
	});
};

// --- Lab action body parsing ---

type LabActionBody = {
	labId: LabId;
	serverVersion: number;
};

type LabResearchActionBody = {
	labId: LabId;
	researchId: ResearchId;
	serverVersion: number;
};

const parseLabActionBody = async (
	request: NextRequest,
): Promise<LabActionBody | NextResponse> => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json(
			{ error: "Body must be an object" },
			{ status: 400 },
		);
	}

	if (!isValidLabId(body.labId)) {
		return NextResponse.json({ error: "Invalid labId" }, { status: 400 });
	}

	if (!isNonNegativeInteger(body.serverVersion)) {
		return NextResponse.json(
			{ error: "Invalid serverVersion" },
			{ status: 400 },
		);
	}

	return { labId: body.labId, serverVersion: body.serverVersion };
};

export const parseLabResearchActionBody = async (
	request: NextRequest,
): Promise<LabResearchActionBody | NextResponse> => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (!isRecord(body)) {
		return NextResponse.json(
			{ error: "Body must be an object" },
			{ status: 400 },
		);
	}

	if (!isValidLabId(body.labId)) {
		return NextResponse.json({ error: "Invalid labId" }, { status: 400 });
	}

	if (!isValidResearchId(body.researchId)) {
		return NextResponse.json({ error: "Invalid researchId" }, { status: 400 });
	}

	if (!isNonNegativeInteger(body.serverVersion)) {
		return NextResponse.json(
			{ error: "Invalid serverVersion" },
			{ status: 400 },
		);
	}

	return {
		labId: body.labId,
		researchId: body.researchId,
		serverVersion: body.serverVersion,
	};
};

// --- Execute lab action pattern ---

export const executeLabAction = async ({
	request,
	action,
}: {
	request: NextRequest;
	action: (args: { state: GameState; labId: LabId }) => GameState;
}): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseLabActionBody(request);
	if (body instanceof NextResponse) {
		return body;
	}
	const { labId, serverVersion } = body;

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== serverVersion) {
		logger.debug(
			{
				sessionId,
				clientVersion: serverVersion,
				serverVersion: stored.serverVersion,
			},
			"Version conflict",
		);
		return NextResponse.json(
			{
				state: stripServerVersion(stored),
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const currentState = deserializeGameState(stored);
	const newState = action({ state: currentState, labId });

	if (newState === currentState) {
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	const newSerialized = serializeGameState(newState);
	const newStored: StoredGameState = {
		...newSerialized,
		serverVersion: stored.serverVersion + 1,
	};
	await saveStoredGameState({ sessionId, stored: newStored });
	await patchSnapshotMetadata({ sessionId, state: newSerialized });

	return NextResponse.json({
		state: newSerialized,
		serverVersion: newStored.serverVersion,
	});
};

// --- Execute boost action pattern ---

export const executeBoostAction = async ({
	request,
	action,
}: {
	request: NextRequest;
	action: (args: { state: GameState; boostId: ShopBoostId }) => GameState;
}): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseBoostActionBody(request);
	if (body instanceof NextResponse) {
		return body;
	}
	const { boostId, serverVersion } = body;

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== serverVersion) {
		logger.debug(
			{
				sessionId,
				clientVersion: serverVersion,
				serverVersion: stored.serverVersion,
			},
			"Version conflict",
		);
		return NextResponse.json(
			{
				state: stripServerVersion(stored),
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const currentState = deserializeGameState(stored);
	const boostedState = action({ state: currentState, boostId });

	if (boostedState === currentState) {
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	// Advance any research that may now be past its completion time after the
	// boost (e.g. research-2x halves level time, so in-progress research that
	// was >50% done is now complete).
	const newState = advanceResearch({ state: boostedState, now: Date.now() });

	const newSerialized = serializeGameState(newState);
	const newStored: StoredGameState = {
		...newSerialized,
		serverVersion: stored.serverVersion + 1,
	};
	await saveStoredGameState({ sessionId, stored: newStored });
	await patchSnapshotMetadata({ sessionId, state: newSerialized });

	return NextResponse.json({
		state: newSerialized,
		serverVersion: newStored.serverVersion,
	});
};
