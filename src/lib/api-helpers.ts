import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import {
	deserializeGameState,
	type SerializedGameState,
	serializeGameState,
} from "@/game/serialization";
import type { GameState, ResourceId } from "@/game/types";
import type { SerializedBigNum } from "@/lib/big-number";
import { buildSyncSnapshot, checkPlausibility } from "./plausibility";
import {
	deleteSyncSnapshot,
	getSyncSnapshot,
	loadStoredGameState,
	type StoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "./redis";
import {
	COOKIE_NAME,
	incrementWarnings,
	resetWarnings,
	validateSession,
} from "./session";

const VALID_RESOURCE_IDS: ReadonlySet<string> = new Set<string>([
	"iron-ore",
	"plates",
	"reinforced-plate",
	"modular-frame",
	"heavy-modular-frame",
	"fused-modular-frame",
]);

// --- Types ---

type ResourceActionBody = {
	resourceId: ResourceId;
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
		return NextResponse.json(
			{ error: "Invalid session format" },
			{ status: 401 },
		);
	}
	const session = await validateSession(sessionId);
	if (!session) {
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

const MAX_WARNINGS = 10;

export type PlausibilitySaveResult =
	| { type: "accepted"; serverVersion: number }
	| {
			type: "corrected";
			state: SerializedGameState;
			serverVersion: number;
			warning: string;
	  }
	| {
			type: "reset_violation";
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
		const warningCount = await incrementWarnings(sessionId);

		if (warningCount >= MAX_WARNINGS) {
			const freshState = serializeGameState(createInitialGameState());
			await saveStoredGameState({
				sessionId,
				stored: { ...freshState, serverVersion: newVersion },
			});
			await deleteSyncSnapshot(sessionId);
			await resetWarnings(sessionId);
			return {
				type: "reset_violation",
				state: freshState,
				serverVersion: newVersion,
				warning: "Too many plausibility violations — game state has been reset",
			};
		}

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

	return NextResponse.json({
		state: newSerialized,
		serverVersion: newStored.serverVersion,
	});
};
