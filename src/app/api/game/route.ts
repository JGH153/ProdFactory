import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SerializedGameState } from "@/game/serialization";
import { getSessionFromRequest, stripServerVersion } from "@/lib/api-helpers";
import { loadStoredGameState } from "@/lib/redis";

type LoadGameResult =
	| { type: "not_found" }
	| { type: "success"; state: SerializedGameState; serverVersion: number };

const loadGame = async (sessionId: string): Promise<LoadGameResult> => {
	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return { type: "not_found" };
	}
	return {
		type: "success",
		state: stripServerVersion(stored),
		serverVersion: stored.serverVersion,
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
	});
};
