import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SerializedGameState } from "@/game/serialization";
import {
	getSessionFromRequest,
	type PlausibilitySaveResult,
	parseSaveActionBody,
	persistWithPlausibility,
	stripServerVersion,
} from "@/lib/api-helpers";
import { loadStoredGameState } from "@/lib/redis";

type SaveGameResult =
	| { type: "conflict"; state: SerializedGameState; serverVersion: number }
	| PlausibilitySaveResult;

const saveGame = async ({
	sessionId,
	claimedState,
	serverVersion,
}: {
	sessionId: string;
	claimedState: SerializedGameState;
	serverVersion: number;
}): Promise<SaveGameResult> => {
	const stored = await loadStoredGameState(sessionId);

	if (stored && stored.serverVersion !== serverVersion) {
		return {
			type: "conflict",
			state: stripServerVersion(stored),
			serverVersion: stored.serverVersion,
		};
	}

	const newVersion = stored ? stored.serverVersion + 1 : 1;

	return persistWithPlausibility({
		sessionId,
		claimedState,
		newVersion,
		updateSnapshotOnClean: false,
	});
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}

	const body = await parseSaveActionBody(request);
	if (body instanceof NextResponse) {
		return body;
	}

	const result = await saveGame({
		sessionId: sessionResult.sessionId,
		claimedState: body.state,
		serverVersion: body.serverVersion,
	});

	if (result.type === "conflict") {
		return NextResponse.json(
			{ state: result.state, serverVersion: result.serverVersion },
			{ status: 409 },
		);
	}

	if (result.type === "corrected" || result.type === "reset_violation") {
		return NextResponse.json({
			state: result.state,
			serverVersion: result.serverVersion,
			warning: result.warning,
		});
	}

	return NextResponse.json({
		serverVersion: result.serverVersion,
		state: null,
		warning: null,
	});
};
