import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUnlockLabError, unlockLab } from "@/game/research-logic";
import { deserializeGameState } from "@/game/state/serialization";
import {
	executeGameAction,
	getSessionFromRequest,
	parseLabActionBody,
} from "@/lib/server/api-helpers";
import { loadStoredGameState } from "@/lib/server/redis";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const clonedRequest = request.clone();

	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const body = await parseLabActionBody(clonedRequest as NextRequest);
	if (body instanceof NextResponse) {
		return body;
	}
	const stored = await loadStoredGameState(sessionResult.sessionId);
	if (stored) {
		const state = deserializeGameState(stored);
		const error = getUnlockLabError({ state, labId: body.labId });
		if (error) {
			return NextResponse.json({ error }, { status: 400 });
		}
	}

	return executeGameAction({
		request,
		parseBody: parseLabActionBody,
		applyAction: unlockLab,
	});
};
