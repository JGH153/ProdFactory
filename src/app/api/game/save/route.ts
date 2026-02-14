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
	const serverNow = Date.now();
	const lastSnapshot = await getSyncSnapshot(sessionId);

	// No snapshot yet — accept state and create a baseline snapshot
	if (!lastSnapshot) {
		await saveStoredGameState({
			sessionId,
			stored: { ...body.state, serverVersion: newVersion },
		});
		const snapshot = buildSyncSnapshot({
			state: body.state,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });

		return NextResponse.json({
			serverVersion: newVersion,
			state: null,
			warning: null,
		});
	}

	// Run plausibility check against last snapshot
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
				serverVersion: newVersion,
				state: freshState,
				warning: "Too many plausibility violations — game state has been reset",
			});
		}

		await saveStoredGameState({
			sessionId,
			stored: { ...result.correctedState, serverVersion: newVersion },
		});
		const snapshot = buildSyncSnapshot({
			state: result.correctedState,
			timestamp: serverNow,
		});
		await setSyncSnapshot({ sessionId, snapshot });

		return NextResponse.json({
			serverVersion: newVersion,
			state: result.correctedState,
			warning: result.warnings.join("; "),
		});
	}

	// Clean save — accept as-is
	await saveStoredGameState({
		sessionId,
		stored: { ...body.state, serverVersion: newVersion },
	});

	return NextResponse.json({
		serverVersion: newVersion,
		state: null,
		warning: null,
	});
};
