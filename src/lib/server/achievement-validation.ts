import { evaluateCondition } from "@/game/achievements/achievement-checker";
import {
	ACHIEVEMENT_CONFIGS,
	ACHIEVEMENT_ORDER,
} from "@/game/achievements/achievement-config";
import type { AchievementState } from "@/game/achievements/achievement-types";
import { createInitialAchievementState } from "@/game/achievements/achievement-types";
import type { SerializedGameState } from "@/game/state/serialization";
import { deserializeGameState } from "@/game/state/serialization";
import { logger } from "./logger";

/**
 * Validate client-claimed achievements against the protected game state.
 * Only accepts achievements whose conditions are actually met.
 * Already-true server achievements are always preserved.
 */
export const validateAchievements = ({
	protectedState,
	serverAchievements,
	clientAchievements,
}: {
	protectedState: SerializedGameState;
	serverAchievements: AchievementState | null;
	clientAchievements?: AchievementState;
}): AchievementState => {
	const base = serverAchievements ?? createInitialAchievementState();

	if (!clientAchievements) {
		return base;
	}

	// Find newly-claimed achievements (client says true, server says false)
	const newClaims = ACHIEVEMENT_ORDER.filter(
		(id) => clientAchievements[id] && !base[id],
	);

	if (newClaims.length === 0) {
		return base;
	}

	// Only deserialize if there are claims to validate
	const gameState = deserializeGameState(protectedState);

	const validated = { ...base };
	const rejected: string[] = [];

	for (const id of newClaims) {
		const config = ACHIEVEMENT_CONFIGS[id];
		if (evaluateCondition({ state: gameState, condition: config.condition })) {
			validated[id] = true;
		} else {
			rejected.push(id);
		}
	}

	if (rejected.length > 0) {
		logger.warn(
			{ rejected, claimedCount: newClaims.length },
			"Rejected unearned achievement claims",
		);
	}

	return validated;
};
