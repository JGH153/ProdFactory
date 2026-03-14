import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAchievementMultiplier } from "@/game/achievements/achievement-multiplier";
import type { AchievementState } from "@/game/achievements/achievement-types";
import type { SerializedGameState } from "@/game/state/serialization";
import { BUILD_ID } from "@/lib/env-frontend";
import { validateAchievements } from "@/lib/server/achievement-validation";
import {
	getSessionFromRequest,
	type PlausibilitySaveResult,
	parseSaveActionBody,
	persistWithPlausibility,
	stripServerVersion,
} from "@/lib/server/api-helpers";
import { buildProtectedState } from "@/lib/server/plausibility";
import {
	loadAchievements,
	loadStoredGameState,
	saveAchievements,
} from "@/lib/server/redis";

type SaveGameResult =
	| { type: "conflict"; state: SerializedGameState; serverVersion: number }
	| PlausibilitySaveResult;

const saveGame = async ({
	sessionId,
	claimedState,
	serverVersion,
	clientAchievements,
}: {
	sessionId: string;
	claimedState: SerializedGameState;
	serverVersion: number;
	clientAchievements?: AchievementState;
}): Promise<SaveGameResult> => {
	const [stored, serverAchievements] = await Promise.all([
		loadStoredGameState(sessionId),
		loadAchievements(sessionId),
	]);

	if (stored && stored.serverVersion !== serverVersion) {
		return {
			type: "conflict",
			state: stripServerVersion(stored),
			serverVersion: stored.serverVersion,
		};
	}

	const serverNow = Date.now();
	const protectedState = buildProtectedState({
		claimedState,
		storedState: stored ?? null,
		serverNow,
	});

	const validated = validateAchievements({
		protectedState,
		serverAchievements,
		...(clientAchievements && { clientAchievements }),
	});

	if (clientAchievements) {
		await saveAchievements({ sessionId, achievements: validated });
	}

	const achievementMul = getAchievementMultiplier({ achievements: validated });
	const newVersion = stored ? stored.serverVersion + 1 : 1;

	return persistWithPlausibility({
		sessionId,
		claimedState,
		storedState: stored ?? null,
		newVersion,
		updateSnapshotOnClean: true,
		achievementMul,
		prebuiltProtectedState: protectedState,
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
		...(body.achievements && { clientAchievements: body.achievements }),
	});

	if (result.type === "conflict") {
		return NextResponse.json(
			{ state: result.state, serverVersion: result.serverVersion },
			{ status: 409 },
		);
	}

	if (result.type === "corrected") {
		return NextResponse.json({
			serverVersion: result.serverVersion,
			state: result.state,
			warning: result.warning,
			buildId: BUILD_ID,
		});
	}

	return NextResponse.json({
		serverVersion: result.serverVersion,
		state: null,
		warning: null,
		buildId: BUILD_ID,
	});
};
