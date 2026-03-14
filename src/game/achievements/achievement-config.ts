import { bigNum } from "@/lib/big-number";
import type { AchievementConfig, AchievementId } from "./achievement-types";

export const ACHIEVEMENT_CONFIGS: Record<AchievementId, AchievementConfig> = {
	"iron-hoarder": {
		id: "iron-hoarder",
		name: "Iron Hoarder",
		description: "Produce 1M Iron Ore (lifetime)",
		rewardPercent: 5,
		condition: {
			kind: "resource-produced",
			resourceId: "iron-ore",
			threshold: bigNum(1_000_000),
		},
	},
	"plate-empire": {
		id: "plate-empire",
		name: "Plate Empire",
		description: "Produce 100K Plates (lifetime)",
		rewardPercent: 5,
		condition: {
			kind: "resource-produced",
			resourceId: "plates",
			threshold: bigNum(100_000),
		},
	},
	"full-chain": {
		id: "full-chain",
		name: "Full Chain",
		description: "Unlock Nuclear Pasta",
		rewardPercent: 5,
		condition: { kind: "resource-unlocked", resourceId: "nuclear-pasta" },
	},
	"first-automation": {
		id: "first-automation",
		name: "First Automation",
		description: "Automate any 1 resource",
		rewardPercent: 3,
		condition: { kind: "any-automated", count: 1 },
	},
	"full-automation": {
		id: "full-automation",
		name: "Full Automation",
		description: "Automate all 8 resources",
		rewardPercent: 10,
		condition: { kind: "all-automated" },
	},
	"speed-demon": {
		id: "speed-demon",
		name: "Speed Demon",
		description: "Reach continuous mode on any resource",
		rewardPercent: 5,
		condition: { kind: "continuous-mode" },
	},
	"producer-army-50": {
		id: "producer-army-50",
		name: "Growing Factory",
		description: "Own 50 total producers across all tiers",
		rewardPercent: 3,
		condition: { kind: "total-producers", threshold: 50 },
	},
	"producer-army-200": {
		id: "producer-army-200",
		name: "Industrial Titan",
		description: "Own 200 total producers across all tiers",
		rewardPercent: 5,
		condition: { kind: "total-producers", threshold: 200 },
	},
	"research-novice": {
		id: "research-novice",
		name: "Research Novice",
		description: "Max out any 1 research type",
		rewardPercent: 3,
		condition: { kind: "max-research-any" },
	},
	"research-master": {
		id: "research-master",
		name: "Research Master",
		description: "Max out all 8 efficiency research types",
		rewardPercent: 10,
		condition: { kind: "all-efficiency-maxed" },
	},
	"shop-spree": {
		id: "shop-spree",
		name: "Shop Spree",
		description: "Activate all 5 shop boosts at once",
		rewardPercent: 5,
		condition: { kind: "all-boosts-active" },
	},
	"nuclear-stockpile": {
		id: "nuclear-stockpile",
		name: "Nuclear Stockpile",
		description: "Produce 100 Nuclear Pasta (lifetime)",
		rewardPercent: 10,
		condition: {
			kind: "resource-produced",
			resourceId: "nuclear-pasta",
			threshold: bigNum(100),
		},
	},
};

export const ACHIEVEMENT_ORDER: AchievementId[] = [
	"iron-hoarder",
	"plate-empire",
	"full-chain",
	"first-automation",
	"full-automation",
	"speed-demon",
	"producer-army-50",
	"producer-army-200",
	"research-novice",
	"research-master",
	"shop-spree",
	"nuclear-stockpile",
];
