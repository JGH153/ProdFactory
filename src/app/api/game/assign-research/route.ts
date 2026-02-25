import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assignResearch, getAssignResearchError } from "@/game/research-logic";
import { deserializeGameState, serializeGameState } from "@/game/serialization";
import {
	getSessionFromRequest,
	parseLabResearchActionBody,
	patchSnapshotMetadata,
} from "@/lib/api-helpers";
import {
	loadStoredGameState,
	type StoredGameState,
	saveStoredGameState,
} from "@/lib/redis";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseLabResearchActionBody(request);
	if (body instanceof NextResponse) {
		return body;
	}
	const { labId, researchId, serverVersion } = body;

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== serverVersion) {
		const { serverVersion: sv, ...state } = stored;
		return NextResponse.json({ state, serverVersion: sv }, { status: 409 });
	}

	const currentState = deserializeGameState(stored);

	const error = getAssignResearchError({
		state: currentState,
		labId,
		researchId,
	});
	if (error !== null) {
		return NextResponse.json({ error }, { status: 400 });
	}

	const newState = assignResearch({
		state: currentState,
		labId,
		researchId,
	});
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
