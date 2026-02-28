import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
import {
	isNonNegativeInteger,
	isRecord,
	isValidBoostId,
	isValidLabId,
	isValidResearchId,
	isValidResourceId,
	validateSerializedGameState,
} from "./api-validation";
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

type LabActionBody = {
	labId: LabId;
	serverVersion: number;
};

type LabResearchActionBody = {
	labId: LabId;
	researchId: ResearchId;
	serverVersion: number;
};

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
	prestige: stored.prestige,
	lastSavedAt: stored.lastSavedAt,
	version: stored.version,
});

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
