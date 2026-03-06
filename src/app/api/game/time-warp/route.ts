import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
	getSessionFromRequest,
	parseTimeWarpBody,
	stripServerVersion,
} from "@/lib/server/api-helpers";
import { logger } from "@/lib/server/logger";
import { computeTimeWarp } from "@/lib/server/offline-progress";
import { buildSyncSnapshot } from "@/lib/server/plausibility";
import { checkRateLimit } from "@/lib/server/rate-limit";
import {
	loadStoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "@/lib/server/redis";

const TIME_WARP_RATE_LIMIT_MAX = 30;
const TIME_WARP_RATE_LIMIT_WINDOW = 60;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const { allowed } = await checkRateLimit({
		key: `time-warp:${sessionId}`,
		maxRequests: TIME_WARP_RATE_LIMIT_MAX,
		windowSeconds: TIME_WARP_RATE_LIMIT_WINDOW,
	});
	if (!allowed) {
		logger.warn({ sessionId }, "Time warp rate limit exceeded");
		return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
	}

	const body = await parseTimeWarpBody(request);
	if (body instanceof NextResponse) {
		return body;
	}

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== body.serverVersion) {
		logger.debug(
			{
				sessionId,
				clientVersion: body.serverVersion,
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

	const state = stripServerVersion(stored);
	const now = Date.now();
	const { updatedState, summary } = computeTimeWarp({
		state,
		durationSeconds: body.durationSeconds,
		serverNow: now,
	});

	if (!summary) {
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	const finalState = {
		...updatedState,
		timeWarpCount: (updatedState.timeWarpCount ?? 0) + 1,
		lastSavedAt: now,
	};
	const newVersion = stored.serverVersion + 1;

	const snapshot = buildSyncSnapshot({
		state: finalState,
		timestamp: now,
	});
	await Promise.all([
		saveStoredGameState({
			sessionId,
			stored: { ...finalState, serverVersion: newVersion },
		}),
		setSyncSnapshot({ sessionId, snapshot }),
	]);

	return NextResponse.json({
		state: finalState,
		serverVersion: newVersion,
		offlineSummary: summary,
	});
};
