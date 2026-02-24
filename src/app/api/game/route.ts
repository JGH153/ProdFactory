import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SerializedGameState } from "@/game/serialization";
import { getSessionFromRequest, stripServerVersion } from "@/lib/api-helpers";
import {
	computeOfflineProgress,
	type SerializedOfflineSummary,
} from "@/lib/offline-progress";
import { loadStoredGameState, saveStoredGameState } from "@/lib/redis";

type LoadGameResult =
	| { type: "not_found" }
	| {
			type: "success";
			state: SerializedGameState;
			serverVersion: number;
			offlineSummary?: SerializedOfflineSummary;
	  };

const loadGame = async (sessionId: string): Promise<LoadGameResult> => {
	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return { type: "not_found" };
	}

	const state = stripServerVersion(stored);
	const { updatedState, summary } = computeOfflineProgress({
		state,
		serverNow: Date.now(),
	});

	if (summary !== null) {
		await saveStoredGameState({
			sessionId,
			stored: { ...updatedState, serverVersion: stored.serverVersion },
		});
	}

	return {
		type: "success",
		state: updatedState,
		serverVersion: stored.serverVersion,
		...(summary !== null && { offlineSummary: summary }),
	};
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}

	const result = await loadGame(sessionResult.sessionId);

	if (result.type === "not_found") {
		return NextResponse.json({ error: "No saved game" }, { status: 404 });
	}

	return NextResponse.json({
		state: result.state,
		serverVersion: result.serverVersion,
		offlineSummary: result.offlineSummary,
	});
};
