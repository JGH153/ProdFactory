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

type SyncGameResult =
	| { type: "not_found" }
	| { type: "conflict"; state: SerializedGameState; serverVersion: number }
	| PlausibilitySaveResult;

const syncGame = async ({
	sessionId,
	claimedState,
	serverVersion,
}: {
	sessionId: string;
	claimedState: SerializedGameState;
	serverVersion: number;
}): Promise<SyncGameResult> => {
	const stored = await loadStoredGameState(sessionId);

	if (!stored) {
		return { type: "not_found" };
	}

	if (stored.serverVersion !== serverVersion) {
		return {
			type: "conflict",
			state: stripServerVersion(stored),
			serverVersion: stored.serverVersion,
		};
	}

	return persistWithPlausibility({
		sessionId,
		claimedState,
		newVersion: stored.serverVersion + 1,
		updateSnapshotOnClean: true,
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

	const result = await syncGame({
		sessionId: sessionResult.sessionId,
		claimedState: body.state,
		serverVersion: body.serverVersion,
	});

	if (result.type === "not_found") {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (result.type === "conflict") {
		return NextResponse.json(
			{ state: result.state, serverVersion: result.serverVersion },
			{ status: 409 },
		);
	}

	if (result.type === "corrected") {
		return NextResponse.json({
			state: result.state,
			serverVersion: result.serverVersion,
			warning: result.warning,
		});
	}

	return NextResponse.json({
		state: null,
		serverVersion: result.serverVersion,
		warning: null,
	});
};
