import type { BigNum } from "@/lib/big-number";
import { bnToNumber } from "@/lib/big-number";

type PrestigeMilestoneId =
	| "first-evaluation"
	| "returning-employee"
	| "familiar-process"
	| "assembly-line"
	| "experienced-builder"
	| "resource-manager"
	| "supply-chain-expert"
	| "efficiency-expert"
	| "full-automation"
	| "industrial-magnate"
	| "factory-tycoon";

type PrestigeMilestone = {
	id: PrestigeMilestoneId;
	requiredPrestiges: number;
	name: string;
	description: string;
};

export const PRESTIGE_MILESTONES: PrestigeMilestone[] = [
	{
		id: "first-evaluation",
		requiredPrestiges: 1,
		name: "First Evaluation",
		description: "Prestige tab permanently visible",
	},
	{
		id: "returning-employee",
		requiredPrestiges: 2,
		name: "Returning Employee",
		description: "Start with 200 Iron Ore",
	},
	{
		id: "familiar-process",
		requiredPrestiges: 3,
		name: "Familiar Process",
		description: "Start with Iron Ore automation",
	},
	{
		id: "assembly-line",
		requiredPrestiges: 4,
		name: "Assembly Line",
		description: "Start with Plates unlocked + automated",
	},
	{
		id: "experienced-builder",
		requiredPrestiges: 5,
		name: "Experienced Builder",
		description: "Start with Plates unlocked + 1 producer",
	},
	{
		id: "resource-manager",
		requiredPrestiges: 6,
		name: "Resource Manager",
		description: "Start with 500 Iron Ore + 100 Plates",
	},
	{
		id: "supply-chain-expert",
		requiredPrestiges: 7,
		name: "Supply Chain Expert",
		description: "Start with Reinforced Plate unlocked + 1 producer",
	},
	{
		id: "efficiency-expert",
		requiredPrestiges: 8,
		name: "Efficiency Expert",
		description: "Start with Reinforced Plate automated",
	},
	{
		id: "full-automation",
		requiredPrestiges: 10,
		name: "Full Automation",
		description: "Start with Iron Ore → Modular Frame automated",
	},
	{
		id: "industrial-magnate",
		requiredPrestiges: 15,
		name: "Industrial Magnate",
		description: "Start with Iron Ore → Heavy Modular Frame unlocked",
	},
	{
		id: "factory-tycoon",
		requiredPrestiges: 20,
		name: "Factory Tycoon",
		description: "Start with 5 producers on Iron Ore → Modular Frame",
	},
];

export const COUPON_BONUS_PER_UNIT = 0.1;

export const PRESTIGE_STREAK_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
export const PRESTIGE_STREAK_BONUS = 0.2; // +20% coupon bonus

export const getPrestigePassiveMultiplier = ({
	lifetimeCoupons,
}: {
	lifetimeCoupons: BigNum;
}): number => {
	const coupons = Math.min(
		bnToNumber(lifetimeCoupons),
		Number.MAX_SAFE_INTEGER,
	);
	return 1 + coupons * COUPON_BONUS_PER_UNIT;
};

export const isMilestoneEarned = ({
	milestoneId,
	prestigeCount,
}: {
	milestoneId: PrestigeMilestoneId;
	prestigeCount: number;
}): boolean => {
	const milestone = PRESTIGE_MILESTONES.find((m) => m.id === milestoneId);
	if (!milestone) {
		return false;
	}
	return prestigeCount >= milestone.requiredPrestiges;
};
