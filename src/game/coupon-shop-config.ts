export type CouponUpgradeId =
	| "producer-discount"
	| "offline-capacity"
	| "coupon-magnet"
	| "speed-surge";

type CouponUpgrade = {
	id: CouponUpgradeId;
	name: string;
	description: string;
	costPerLevel: number;
	maxLevel: number;
};

export const COUPON_UPGRADES: Record<CouponUpgradeId, CouponUpgrade> = {
	"producer-discount": {
		id: "producer-discount",
		name: "Producer Discount",
		description: "Producers get cheaper to buy (−0.5% scaling per level)",
		costPerLevel: 2,
		maxLevel: 10,
	},
	"offline-capacity": {
		id: "offline-capacity",
		name: "Offline Capacity+",
		description: "+10 min offline cap per level",
		costPerLevel: 2,
		maxLevel: 12,
	},
	"coupon-magnet": {
		id: "coupon-magnet",
		name: "Coupon Magnet",
		description: "+10% coupon earnings per prestige",
		costPerLevel: 4,
		maxLevel: 4,
	},
	"speed-surge": {
		id: "speed-surge",
		name: "Speed Surge",
		description: "All run times reduced by 10% per level",
		costPerLevel: 10,
		maxLevel: 3,
	},
};

export const COUPON_UPGRADE_ORDER: CouponUpgradeId[] = [
	"producer-discount",
	"offline-capacity",
	"coupon-magnet",
	"speed-surge",
];

/** Base producer cost scaling factor before discount */
const BASE_COST_SCALING = 1.15;

/** Producer cost scaling reduction per level of producer-discount */
const COST_SCALING_REDUCTION_PER_LEVEL = 0.005;

/** Speed surge run time multiplier: 0.9^level */
export const getSpeedSurgeMultiplier = ({ level }: { level: number }): number =>
	0.9 ** level;

/** Offline capacity bonus: 600 seconds (10 minutes) per level */
export const OFFLINE_CAPACITY_BONUS_PER_LEVEL = 600;

/** Coupon magnet bonus: 10% per level */
export const COUPON_MAGNET_BONUS_PER_LEVEL = 0.1;

/** Get the effective producer cost scaling factor */
export const getEffectiveCostScaling = ({ level }: { level: number }): number =>
	BASE_COST_SCALING - level * COST_SCALING_REDUCTION_PER_LEVEL;
