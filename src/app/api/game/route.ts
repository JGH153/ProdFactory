import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-helpers";
import { loadStoredGameState } from "@/lib/redis";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No saved game" }, { status: 404 });
	}

	return NextResponse.json({
		state: {
			resources: stored.resources,
			lastSavedAt: stored.lastSavedAt,
			version: stored.version,
		},
		serverVersion: stored.serverVersion,
	});
};
