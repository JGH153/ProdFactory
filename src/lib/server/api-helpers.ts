import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
import {
	buildProtectedState,
	buildSyncSnapshot,
	checkPlausibility,
	INITIAL_SERIALIZED,
	stripServerVersion,
} from "./plausibility";
import { checkRateLimit } from "./rate-limit";
import {
	getSyncSnapshot,
	loadStoredGameState,
	type StoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "./redis";
import { COOKIE_NAME, incrementWarnings, validateSession } from "./session";

type SaveActionBody = {
	state: SerializedGameState;
	serverVersion: number;
};

// --- Session & rate limiting ---

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

const ACTION_RATE_LIMIT_MAX = 120;
const ACTION_RATE_LIMIT_WINDOW = 60;

const checkActionRateLimit = async (
	sessionId: string,
): Promise<NextResponse | null> => {
	const { allowed } = await checkRateLimit({
		key: `session-action:${sessionId}`,
		maxRequests: ACTION_RATE_LIMIT_MAX,
		windowSeconds: ACTION_RATE_LIMIT_WINDOW,
	});
	if (!allowed) {
		logger.warn({ sessionId }, "Session action rate limit exceeded");
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}
	return null;
};

export { stripServerVersion };

// --- Generic body parser builder ---

type FieldDef = {
	validate: (value: unknown) => boolean;
	error: string;
};

const createBodyParser =
	<TFields extends Record<string, unknown>>(
		fields: { [K in keyof TFields]: FieldDef },
	) =>
	async (
		request: NextRequest,
	): Promise<(TFields & { serverVersion: number }) | NextResponse> => {
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

		for (const key of Object.keys(fields)) {
			const spec = (fields as Record<string, FieldDef | undefined>)[key];
			if (spec && !spec.validate(body[key])) {
				return NextResponse.json({ error: spec.error }, { status: 400 });
			}
		}

		if (!isNonNegativeInteger(body.serverVersion)) {
			return NextResponse.json(
				{ error: "Invalid serverVersion" },
				{ status: 400 },
			);
		}

		const result = { serverVersion: body.serverVersion } as TFields & {
			serverVersion: number;
		};
		for (const key of Object.keys(fields)) {
			(result as Record<string, unknown>)[key] = body[key];
		}
		return result;
	};

// --- Body parsers ---

export const parseResourceActionBody = createBodyParser<{
	resourceId: ResourceId;
}>({
	resourceId: { validate: isValidResourceId, error: "Invalid resourceId" },
});

export const parseBoostActionBody = createBodyParser<{
	boostId: ShopBoostId;
}>({
	boostId: { validate: isValidBoostId, error: "Invalid boostId" },
});

export const parseLabActionBody = createBodyParser<{ labId: LabId }>({
	labId: { validate: isValidLabId, error: "Invalid labId" },
});

export const parseLabResearchActionBody = createBodyParser<{
	labId: LabId;
	researchId: ResearchId;
}>({
	labId: { validate: isValidLabId, error: "Invalid labId" },
	researchId: { validate: isValidResearchId, error: "Invalid researchId" },
});

export const parseVersionOnlyBody = createBodyParser({});

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

// --- Plausibility ---

// Grace period for the first save — covers the time between session creation
// and the first auto-save (~5s) with generous headroom for slow networks.
const FIRST_SAVE_GRACE_MS = 30_000;

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
	storedState,
	newVersion,
	updateSnapshotOnClean,
}: {
	sessionId: string;
	claimedState: SerializedGameState;
	storedState: StoredGameState | null;
	newVersion: number;
	updateSnapshotOnClean: boolean;
}): Promise<PlausibilitySaveResult> => {
	const serverNow = Date.now();
	const protectedState = buildProtectedState({
		claimedState,
		storedState,
		serverNow,
	});

	const existingSnapshot = await getSyncSnapshot(sessionId);

	// When no snapshot exists (first save or snapshot expired), build a baseline
	// from the initial game state so the plausibility check still runs.
	const effectiveSnapshot =
		existingSnapshot ??
		buildSyncSnapshot({
			state: INITIAL_SERIALIZED,
			timestamp: serverNow - FIRST_SAVE_GRACE_MS,
		});

	const result = checkPlausibility({
		claimedState: protectedState,
		lastSnapshot: effectiveSnapshot,
		serverNow,
	});

	if (result.corrected && result.correctedState) {
		logger.warn(
			{ sessionId, warnings: result.warnings },
			"State corrected by plausibility check",
		);
		await incrementWarnings(sessionId);

		const snapshot = buildSyncSnapshot({
			state: result.correctedState,
			timestamp: serverNow,
		});
		await Promise.all([
			saveStoredGameState({
				sessionId,
				stored: { ...result.correctedState, serverVersion: newVersion },
			}),
			setSyncSnapshot({ sessionId, snapshot }),
		]);
		return {
			type: "corrected",
			state: result.correctedState,
			serverVersion: newVersion,
			warning: result.warnings.join("; "),
		};
	}

	const savePromise = saveStoredGameState({
		sessionId,
		stored: { ...protectedState, serverVersion: newVersion },
	});
	if (updateSnapshotOnClean || !existingSnapshot) {
		const snapshot = buildSyncSnapshot({
			state: protectedState,
			timestamp: serverNow,
		});
		await Promise.all([savePromise, setSyncSnapshot({ sessionId, snapshot })]);
	} else {
		await savePromise;
	}
	return { type: "accepted", serverVersion: newVersion };
};

const patchSnapshotMetadata = async ({
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
			resources: fresh.resources,
			...(fresh.research && { research: fresh.research }),
			...(fresh.labs && { labs: fresh.labs }),
		},
	});
};

// --- Unified action executor ---

export const executeGameAction = async <
	TBody extends { serverVersion: number },
>({
	request,
	parseBody,
	applyAction,
	afterApply,
}: {
	request: NextRequest;
	parseBody: (request: NextRequest) => Promise<TBody | NextResponse>;
	applyAction: (
		args: { state: GameState } & Omit<TBody, "serverVersion">,
	) => GameState;
	afterApply?: (args: { state: GameState }) => GameState;
}): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const rateLimited = await checkActionRateLimit(sessionId);
	if (rateLimited) {
		return rateLimited;
	}

	const body = await parseBody(request);
	if (body instanceof NextResponse) {
		return body;
	}
	const { serverVersion, ...actionParams } = body;

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
	const appliedState = applyAction({
		state: currentState,
		...actionParams,
	} as { state: GameState } & Omit<TBody, "serverVersion">);

	if (appliedState === currentState) {
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	const newState = afterApply
		? afterApply({ state: appliedState })
		: appliedState;

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
