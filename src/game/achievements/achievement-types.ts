import type { BigNum } from "@/lib/big-number";
import type { ResourceId } from "../types";

export type AchievementId =
	| "iron-hoarder"
	| "plate-empire"
	| "full-chain"
	| "first-automation"
	| "full-automation"
	| "speed-demon"
	| "producer-army-50"
	| "producer-army-200"
	| "research-novice"
	| "research-master"
	| "shop-spree"
	| "nuclear-stockpile";

export type AchievementState = Record<AchievementId, boolean>;

export type AchievementCondition =
	| { kind: "resource-produced"; resourceId: ResourceId; threshold: BigNum }
	| { kind: "resource-unlocked"; resourceId: ResourceId }
	| { kind: "any-automated"; count: number }
	| { kind: "all-automated" }
	| { kind: "continuous-mode" }
	| { kind: "total-producers"; threshold: number }
	| { kind: "max-research-any" }
	| { kind: "all-efficiency-maxed" }
	| { kind: "all-boosts-active" };

export type AchievementConfig = {
	id: AchievementId;
	name: string;
	description: string;
	rewardPercent: number;
	condition: AchievementCondition;
};

export const ACHIEVEMENT_IDS: AchievementId[] = [
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

export const createInitialAchievementState = (): AchievementState => ({
	"iron-hoarder": false,
	"plate-empire": false,
	"full-chain": false,
	"first-automation": false,
	"full-automation": false,
	"speed-demon": false,
	"producer-army-50": false,
	"producer-army-200": false,
	"research-novice": false,
	"research-master": false,
	"shop-spree": false,
	"nuclear-stockpile": false,
});
