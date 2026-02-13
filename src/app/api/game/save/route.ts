import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromRequest, parseSaveActionBody } from "@/lib/api-helpers";
import { loadStoredGameState, saveStoredGameState } from "@/lib/redis";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseSaveActionBody(request);
	if (body instanceof NextResponse) {
		return body;
	}

	const stored = await loadStoredGameState(sessionId);

	if (stored && stored.serverVersion !== body.serverVersion) {
		return NextResponse.json(
			{
				state: {
					resources: stored.resources,
					lastSavedAt: stored.lastSavedAt,
					version: stored.version,
				},
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const newVersion = stored ? stored.serverVersion + 1 : 1;
	await saveStoredGameState({
		sessionId,
		stored: {
			...body.state,
			serverVersion: newVersion,
		},
	});

	return NextResponse.json({ serverVersion: newVersion });
};
