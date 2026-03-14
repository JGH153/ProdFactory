import { bnGte } from "@/lib/big-number";
import { RESOURCE_ORDER } from "../config";
import {
	EFFICIENCY_RESEARCH_ORDER,
	getMaxLevelForResearch,
	getSpeedResearchMultiplier,
} from "../research-config";
import { getRunTimeMultiplier, isContinuousMode } from "../run-timing";
import type { GameState, ShopBoostId } from "../types";
import { ACHIEVEMENT_CONFIGS, ACHIEVEMENT_ORDER } from "./achievement-config";
import type {
	AchievementCondition,
	AchievementId,
	AchievementState,
} from "./achievement-types";
import { ACHIEVEMENT_IDS } from "./achievement-types";

const SHOP_BOOST_IDS: ShopBoostId[] = [
	"production-2x",
	"automation-2x",
	"runtime-50",
	"research-2x",
	"offline-2h",
];

export const evaluateCondition = ({
	state,
	condition,
}: {
	state: GameState;
	condition: AchievementCondition;
}): boolean => {
	switch (condition.kind) {
		case "resource-produced":
			return bnGte(
				state.resources[condition.resourceId].lifetimeProduced,
				condition.threshold,
			);

		case "resource-unlocked":
			return state.resources[condition.resourceId].isUnlocked;

		case "any-automated": {
			let count = 0;
			for (const resourceId of RESOURCE_ORDER) {
				if (state.resources[resourceId].isAutomated) {
					count++;
				}
			}
			return count >= condition.count;
		}

		case "all-automated":
			return RESOURCE_ORDER.every((id) => state.resources[id].isAutomated);

		case "continuous-mode":
			return RESOURCE_ORDER.some((resourceId) => {
				const resource = state.resources[resourceId];
				if (!resource.isUnlocked || resource.producers === 0) {
					return false;
				}
				const runTimeMultiplier = getRunTimeMultiplier({
					shopBoosts: state.shopBoosts,
					isAutomated: resource.isAutomated && !resource.isPaused,
					speedResearchMultiplier: getSpeedResearchMultiplier({
						research: state.research,
						resourceId,
					}),
					speedSurgeLevel: state.couponUpgrades["speed-surge"],
				});
				return isContinuousMode({
					resourceId,
					producers: resource.producers,
					runTimeMultiplier,
				});
			});

		case "total-producers": {
			let total = 0;
			for (const resourceId of RESOURCE_ORDER) {
				total += state.resources[resourceId].producers;
			}
			return total >= condition.threshold;
		}

		case "max-research-any":
			return (
				ACHIEVEMENT_IDS.length > 0 &&
				Object.entries(state.research).some(
					([researchId, level]) =>
						level >=
						getMaxLevelForResearch(researchId as keyof typeof state.research),
				)
			);

		case "all-efficiency-maxed":
			return EFFICIENCY_RESEARCH_ORDER.every(
				(id) => state.research[id] >= getMaxLevelForResearch(id),
			);

		case "all-boosts-active":
			return SHOP_BOOST_IDS.every((id) => state.shopBoosts[id]);
	}
};

/**
 * Check all achievements against current game state.
 * Returns a new AchievementState if any changed, or the same reference if not.
 */
export const checkAchievements = ({
	state,
	achievements,
}: {
	state: GameState;
	achievements: AchievementState;
}): { updated: AchievementState; newlyCompleted: AchievementId[] } => {
	const newlyCompleted: AchievementId[] = [];

	for (const id of ACHIEVEMENT_ORDER) {
		if (achievements[id]) {
			continue;
		}
		const config = ACHIEVEMENT_CONFIGS[id];
		if (evaluateCondition({ state, condition: config.condition })) {
			newlyCompleted.push(id);
		}
	}

	if (newlyCompleted.length === 0) {
		return { updated: achievements, newlyCompleted };
	}

	const updated = { ...achievements };
	for (const id of newlyCompleted) {
		updated[id] = true;
	}
	return { updated, newlyCompleted };
};
