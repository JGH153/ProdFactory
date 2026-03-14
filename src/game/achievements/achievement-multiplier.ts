import { bnToNumber } from "@/lib/big-number";
import { RESOURCE_ORDER } from "../config";
import {
	EFFICIENCY_RESEARCH_ORDER,
	getMaxLevelForResearch,
	getSpeedResearchMultiplier,
} from "../research-config";
import { getRunTimeMultiplier, isContinuousMode } from "../run-timing";
import type { GameState, ShopBoostId } from "../types";
import { ACHIEVEMENT_CONFIGS, ACHIEVEMENT_ORDER } from "./achievement-config";
import type { AchievementId, AchievementState } from "./achievement-types";

const SHOP_BOOST_IDS: ShopBoostId[] = [
	"production-2x",
	"automation-2x",
	"runtime-50",
	"research-2x",
	"offline-2h",
];

/** Compute the achievement production multiplier: 1 + (sum of reward%) / 100 */
export const getAchievementMultiplier = ({
	achievements,
}: {
	achievements: AchievementState;
}): number => {
	let totalPercent = 0;
	for (const id of ACHIEVEMENT_ORDER) {
		if (achievements[id]) {
			totalPercent += ACHIEVEMENT_CONFIGS[id].rewardPercent;
		}
	}
	return 1 + totalPercent / 100;
};

/** Count completed achievements */
export const getCompletedCount = ({
	achievements,
}: {
	achievements: AchievementState;
}): number => {
	let count = 0;
	for (const id of ACHIEVEMENT_ORDER) {
		if (achievements[id]) {
			count++;
		}
	}
	return count;
};

/** Get total reward percent from completed achievements */
export const getTotalRewardPercent = ({
	achievements,
}: {
	achievements: AchievementState;
}): number => {
	let totalPercent = 0;
	for (const id of ACHIEVEMENT_ORDER) {
		if (achievements[id]) {
			totalPercent += ACHIEVEMENT_CONFIGS[id].rewardPercent;
		}
	}
	return totalPercent;
};

type AchievementProgress = {
	current: number;
	target: number;
	fraction: number;
};

/** Compute progress (0-1) for a specific achievement */
export const computeAchievementProgress = ({
	state,
	achievementId,
}: {
	state: GameState;
	achievementId: AchievementId;
}): AchievementProgress => {
	const config = ACHIEVEMENT_CONFIGS[achievementId];
	const { condition } = config;

	switch (condition.kind) {
		case "resource-produced": {
			const current = bnToNumber(
				state.resources[condition.resourceId].lifetimeProduced,
			);
			const target = bnToNumber(condition.threshold);
			return {
				current,
				target,
				fraction: Math.min(current / target, 1),
			};
		}

		case "resource-unlocked":
			return state.resources[condition.resourceId].isUnlocked
				? { current: 1, target: 1, fraction: 1 }
				: { current: 0, target: 1, fraction: 0 };

		case "any-automated": {
			let count = 0;
			for (const resourceId of RESOURCE_ORDER) {
				if (state.resources[resourceId].isAutomated) {
					count++;
				}
			}
			return {
				current: count,
				target: condition.count,
				fraction: Math.min(count / condition.count, 1),
			};
		}

		case "all-automated": {
			let count = 0;
			for (const resourceId of RESOURCE_ORDER) {
				if (state.resources[resourceId].isAutomated) {
					count++;
				}
			}
			return {
				current: count,
				target: RESOURCE_ORDER.length,
				fraction: count / RESOURCE_ORDER.length,
			};
		}

		case "continuous-mode": {
			const hasContinuous = RESOURCE_ORDER.some((resourceId) => {
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
			return hasContinuous
				? { current: 1, target: 1, fraction: 1 }
				: { current: 0, target: 1, fraction: 0 };
		}

		case "total-producers": {
			let total = 0;
			for (const resourceId of RESOURCE_ORDER) {
				total += state.resources[resourceId].producers;
			}
			return {
				current: total,
				target: condition.threshold,
				fraction: Math.min(total / condition.threshold, 1),
			};
		}

		case "max-research-any": {
			let maxProgress = 0;
			for (const [researchId, level] of Object.entries(state.research)) {
				const maxLevel = getMaxLevelForResearch(
					researchId as keyof typeof state.research,
				);
				const progress = level / maxLevel;
				if (progress > maxProgress) {
					maxProgress = progress;
				}
			}
			return {
				current: Math.round(maxProgress * 100),
				target: 100,
				fraction: maxProgress,
			};
		}

		case "all-efficiency-maxed": {
			let maxed = 0;
			for (const id of EFFICIENCY_RESEARCH_ORDER) {
				if (state.research[id] >= getMaxLevelForResearch(id)) {
					maxed++;
				}
			}
			return {
				current: maxed,
				target: EFFICIENCY_RESEARCH_ORDER.length,
				fraction: maxed / EFFICIENCY_RESEARCH_ORDER.length,
			};
		}

		case "all-boosts-active": {
			let active = 0;
			for (const id of SHOP_BOOST_IDS) {
				if (state.shopBoosts[id]) {
					active++;
				}
			}
			return {
				current: active,
				target: SHOP_BOOST_IDS.length,
				fraction: active / SHOP_BOOST_IDS.length,
			};
		}
	}
};
