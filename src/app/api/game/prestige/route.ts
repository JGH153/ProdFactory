import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { performPrestige } from "@/game/logic";
import {
	deserializeGameState,
	serializeGameState,
} from "@/game/state/serialization";
import {
	getSessionFromRequest,
	parseVersionOnlyBody,
	stripServerVersion,
} from "@/lib/server/api-helpers";
import { logger } from "@/lib/server/logger";
import {
	deleteSyncSnapshot,
	loadStoredGameState,
	saveStoredGameState,
} from "@/lib/server/redis";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
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
		return NextResponse.json(
			{
				state: stripServerVersion(stored),
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const currentState = deserializeGameState(stored);
	const newState = performPrestige({ state: currentState });

	if (newState === currentState) {
		logger.info(
			{
				sessionId,
				prestigeCount: currentState.prestige.prestigeCount,
				nuclearPastaProducedThisRun:
					currentState.prestige.nuclearPastaProducedThisRun,
			},
			"Prestige attempted but not available",
		);
		return NextResponse.json(
			{ error: "Action had no effect" },
			{ status: 400 },
		);
	}

	const newSerialized = serializeGameState(newState);
	const newVersion = stored.serverVersion + 1;

	await Promise.all([
		saveStoredGameState({
			sessionId,
			stored: { ...newSerialized, serverVersion: newVersion },
		}),
		deleteSyncSnapshot(sessionId),
	]);

	return NextResponse.json({
		state: newSerialized,
		serverVersion: newVersion,
	});
};
