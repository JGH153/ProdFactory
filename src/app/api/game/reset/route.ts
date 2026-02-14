import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createInitialGameState } from "@/game/initial-state";
import type { SerializedGameState } from "@/game/serialization";
import { serializeGameState } from "@/game/serialization";
import {
	getSessionFromRequest,
	parseVersionOnlyBody,
	stripServerVersion,
} from "@/lib/api-helpers";
import {
	deleteSyncSnapshot,
	loadStoredGameState,
	saveStoredGameState,
} from "@/lib/redis";

type ResetGameResult =
	| { type: "conflict"; state: SerializedGameState; serverVersion: number }
	| { type: "success"; state: SerializedGameState; serverVersion: number };

const resetGame = async ({
	sessionId,
	serverVersion,
}: {
	sessionId: string;
	serverVersion: number;
}): Promise<ResetGameResult> => {
	const stored = await loadStoredGameState(sessionId);

	if (stored && stored.serverVersion !== serverVersion) {
		return {
			type: "conflict",
			state: stripServerVersion(stored),
			serverVersion: stored.serverVersion,
		};
	}

	const freshState = serializeGameState(createInitialGameState());
	const newVersion = stored ? stored.serverVersion + 1 : 1;

	await saveStoredGameState({
		sessionId,
		stored: { ...freshState, serverVersion: newVersion },
	});
	await deleteSyncSnapshot(sessionId);

	return { type: "success", state: freshState, serverVersion: newVersion };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}

	const body = await parseVersionOnlyBody(request);
	if (body instanceof NextResponse) {
		return body;
	}

	const result = await resetGame({
		sessionId: sessionResult.sessionId,
		serverVersion: body.serverVersion,
	});

	if (result.type === "conflict") {
		return NextResponse.json(
			{ state: result.state, serverVersion: result.serverVersion },
			{ status: 409 },
		);
	}

	return NextResponse.json({
		state: result.state,
		serverVersion: result.serverVersion,
	});
};
