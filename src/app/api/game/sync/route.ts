import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionFromRequest, parseSaveActionBody } from "@/lib/api-helpers";
import { buildSyncSnapshot, checkPlausibility } from "@/lib/plausibility";
import {
	getSyncSnapshot,
	loadStoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "@/lib/redis";
import { incrementWarnings } from "@/lib/session";

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
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== body.serverVersion) {
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

	const lastSnapshot = await getSyncSnapshot(sessionId);
	const serverNow = Date.now();
	const newVersion = stored.serverVersion + 1;

	if (!lastSnapshot) {
		const newStored = { ...body.state, serverVersion: newVersion };
		await saveStoredGameState(sessionId, newStored);
		const snapshot = buildSyncSnapshot(body.state, serverNow);
		await setSyncSnapshot(sessionId, snapshot);

		return NextResponse.json({
			state: null,
			serverVersion: newVersion,
			warning: null,
		});
	}

	const result = checkPlausibility(body.state, lastSnapshot, serverNow);

	if (result.corrected && result.correctedState) {
		const correctedStored = {
			...result.correctedState,
			serverVersion: newVersion,
		};
		await saveStoredGameState(sessionId, correctedStored);
		const snapshot = buildSyncSnapshot(result.correctedState, serverNow);
		await setSyncSnapshot(sessionId, snapshot);
		await incrementWarnings(sessionId);

		return NextResponse.json({
			state: result.correctedState,
			serverVersion: newVersion,
			warning: result.warnings.join("; "),
		});
	}

	const acceptedStored = { ...body.state, serverVersion: newVersion };
	await saveStoredGameState(sessionId, acceptedStored);
	const snapshot = buildSyncSnapshot(body.state, serverNow);
	await setSyncSnapshot(sessionId, snapshot);

	return NextResponse.json({
		state: null,
		serverVersion: newVersion,
		warning: null,
	});
};
