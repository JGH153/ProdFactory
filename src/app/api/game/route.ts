import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAchievementMultiplier } from "@/game/achievements/achievement-multiplier";
import type { AchievementState } from "@/game/achievements/achievement-types";
import { createInitialAchievementState } from "@/game/achievements/achievement-types";
import type { SerializedGameState } from "@/game/state/serialization";
import {
	getSessionFromRequest,
	stripServerVersion,
} from "@/lib/server/api-helpers";
import {
	computeOfflineProgress,
	type SerializedOfflineSummary,
} from "@/lib/server/offline-progress";
import { buildSyncSnapshot } from "@/lib/server/plausibility";
import {
	loadAchievements,
	loadStoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "@/lib/server/redis";

type LoadGameResult =
	| { type: "not_found" }
	| {
			type: "success";
			state: SerializedGameState;
			serverVersion: number;
			offlineSummary?: SerializedOfflineSummary;
			achievements: AchievementState;
	  };

const loadGame = async (sessionId: string): Promise<LoadGameResult> => {
	const [stored, achievements] = await Promise.all([
		loadStoredGameState(sessionId),
		loadAchievements(sessionId),
	]);
	if (!stored) {
		return { type: "not_found" };
	}

	const resolvedAchievements = achievements ?? createInitialAchievementState();
	const achievementMul = getAchievementMultiplier({
		achievements: resolvedAchievements,
	});

	const state = stripServerVersion(stored);
	const serverNow = Date.now();
	const { updatedState, summary } = computeOfflineProgress({
		state,
		serverNow,
		achievementMul,
	});

	if (summary !== null) {
		// Update sync snapshot so the plausibility check baseline reflects
		// the post-offline state — prevents the next save/sync from flagging
		// legitimate offline gains as implausible.
		const snapshot = buildSyncSnapshot({
			state: updatedState,
			timestamp: serverNow,
		});
		await Promise.all([
			saveStoredGameState({
				sessionId,
				stored: { ...updatedState, serverVersion: stored.serverVersion },
			}),
			setSyncSnapshot({ sessionId, snapshot }),
		]);
	}

	return {
		type: "success",
		state: updatedState,
		serverVersion: stored.serverVersion,
		...(summary !== null && { offlineSummary: summary }),
		achievements: resolvedAchievements,
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
		offlineSummary: result.offlineSummary,
		achievements: result.achievements,
	});
};
