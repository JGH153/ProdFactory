import type { BigNum } from "@/lib/big-number";
import { bnToNumber } from "@/lib/big-number";

type PrestigeMilestoneId =
	| "first-evaluation"
	| "returning-employee"
	| "familiar-process"
	| "experienced-builder";

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
		description: "Iron Ore automation free at start",
	},
	{
		id: "experienced-builder",
		requiredPrestiges: 5,
		name: "Experienced Builder",
		description: "Start with Plates already unlocked",
	},
];

export const COUPON_BONUS_PER_UNIT = 0.02;

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
