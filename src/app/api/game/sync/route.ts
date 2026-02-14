import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createInitialGameState } from "@/game/initial-state";
import { serializeGameState } from "@/game/serialization";
import { getSessionFromRequest, parseSaveActionBody } from "@/lib/api-helpers";
import { buildSyncSnapshot, checkPlausibility } from "@/lib/plausibility";
import {
	deleteSyncSnapshot,
	getSyncSnapshot,
	loadStoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "@/lib/redis";
import { incrementWarnings, resetWarnings } from "@/lib/session";

const MAX_WARNINGS = 10;

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
		await saveStoredGameState({ sessionId, stored: newStored });
		const snapshot = buildSyncSnapshot({
			state: body.state,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });

		return NextResponse.json({
			state: null,
			serverVersion: newVersion,
			warning: null,
		});
	}

	const result = checkPlausibility({
		claimedState: body.state,
		lastSnapshot,
		serverNow,
	});

	if (result.corrected && result.correctedState) {
		const warningCount = await incrementWarnings(sessionId);

		if (warningCount >= MAX_WARNINGS) {
			const freshState = serializeGameState(createInitialGameState());
			const resetStored = { ...freshState, serverVersion: newVersion };
			await saveStoredGameState({ sessionId, stored: resetStored });
			await deleteSyncSnapshot(sessionId);
			await resetWarnings(sessionId);

			return NextResponse.json({
				state: freshState,
				serverVersion: newVersion,
				warning: "Too many plausibility violations — game state has been reset",
			});
		}

		const correctedStored = {
			...result.correctedState,
			serverVersion: newVersion,
		};
		await saveStoredGameState({ sessionId, stored: correctedStored });
		const snapshot = buildSyncSnapshot({
			state: result.correctedState,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });

		return NextResponse.json({
			state: result.correctedState,
			serverVersion: newVersion,
			warning: result.warnings.join("; "),
		});
	}

	const acceptedStored = { ...body.state, serverVersion: newVersion };
	await saveStoredGameState({ sessionId, stored: acceptedStored });
	const snapshot = buildSyncSnapshot({
		state: body.state,
		timestamp: serverNow,
	});
	await setSyncSnapshot({ sessionId, snapshot });

	return NextResponse.json({
		state: null,
		serverVersion: newVersion,
		warning: null,
	});
};
