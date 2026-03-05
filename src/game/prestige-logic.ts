import {
	type BigNum,
	bigNum,
	bigNumZero,
	bnAdd,
	bnFloor,
	bnIsZero,
	bnSqrt,
} from "@/lib/big-number";
import { createInitialGameState } from "./initial-state";
import { LAB_ORDER } from "./research-config";
import type { GameState, LabId, LabState } from "./types";

const BASE_COUPONS_PER_PRESTIGE = 5;

export const computeCouponsEarned = ({
	nuclearPastaProducedThisRun,
}: {
	nuclearPastaProducedThisRun: BigNum;
}): BigNum => {
	return bnAdd(
		bnFloor(bnSqrt(nuclearPastaProducedThisRun)),
		bigNum(BASE_COUPONS_PER_PRESTIGE),
	);
};

export const canPrestige = ({ state }: { state: GameState }): boolean => {
	return !bnIsZero(state.prestige.nuclearPastaProducedThisRun);
};

export const performPrestige = ({ state }: { state: GameState }): GameState => {
	if (!canPrestige({ state })) {
		return state;
	}

	const couponsEarned = computeCouponsEarned({
		nuclearPastaProducedThisRun: state.prestige.nuclearPastaProducedThisRun,
	});
	const newPrestigeCount = state.prestige.prestigeCount + 1;
	const newLifetimeCoupons = bnAdd(
		state.prestige.lifetimeCoupons,
		couponsEarned,
	);
	const newCouponBalance = bnAdd(state.prestige.couponBalance, couponsEarned);

	const hasMilestone = (requiredPrestiges: number) =>
		newPrestigeCount >= requiredPrestiges;

	// Start from fresh initial resources
	const freshState = createInitialGameState();
	const freshResources = { ...freshState.resources };

	// Milestone: "returning-employee" (2 prestiges) — start with 200 Iron Ore
	if (hasMilestone(2)) {
		freshResources["iron-ore"] = {
			...freshResources["iron-ore"],
			amount: bigNum(200),
		};
	}

	// Milestone: "familiar-process" (3 prestiges) — free Iron Ore automation
	if (hasMilestone(3)) {
		freshResources["iron-ore"] = {
			...freshResources["iron-ore"],
			isAutomated: true,
		};
	}

	// Milestone: "experienced-builder" (5 prestiges) — Plates unlocked
	if (hasMilestone(5)) {
		freshResources.plates = {
			...freshResources.plates,
			isUnlocked: true,
			producers: 1,
		};
	}

	// Milestone: "supply-chain-expert" (7 prestiges) — Reinforced Plate unlocked
	if (hasMilestone(7)) {
		freshResources["reinforced-plate"] = {
			...freshResources["reinforced-plate"],
			isUnlocked: true,
			producers: 1,
		};
	}

	// Milestone: "full-automation" (10 prestiges) — tiers 0-3 automated
	if (hasMilestone(10)) {
		for (const id of [
			"iron-ore",
			"plates",
			"reinforced-plate",
			"modular-frame",
		] as const) {
			freshResources[id] = {
				...freshResources[id],
				isUnlocked: true,
				isAutomated: true,
				producers: Math.max(freshResources[id].producers, 1),
			};
		}
	}

	// Milestone: "industrial-magnate" (15 prestiges) — through Heavy Modular Frame unlocked
	if (hasMilestone(15)) {
		for (const id of [
			"iron-ore",
			"plates",
			"reinforced-plate",
			"modular-frame",
			"heavy-modular-frame",
		] as const) {
			freshResources[id] = {
				...freshResources[id],
				isUnlocked: true,
				producers: Math.max(freshResources[id].producers, 1),
			};
		}
	}

	// Milestone: "factory-tycoon" (20 prestiges) — Modular Frame unlocked + 5 producers on early tiers
	if (hasMilestone(20)) {
		for (const id of [
			"iron-ore",
			"plates",
			"reinforced-plate",
			"modular-frame",
		] as const) {
			freshResources[id] = {
				...freshResources[id],
				isUnlocked: true,
				producers: Math.max(freshResources[id].producers, 5),
			};
		}
	}

	// Clear lab assignments but keep unlock status
	const resetLabs = {} as Record<LabId, LabState>;
	for (const labId of LAB_ORDER) {
		resetLabs[labId] = {
			isUnlocked: state.labs[labId].isUnlocked,
			activeResearchId: null,
			researchStartedAt: null,
		};
	}

	return {
		resources: freshResources,
		shopBoosts: state.shopBoosts,
		labs: resetLabs,
		research: { ...state.research },
		prestige: {
			prestigeCount: newPrestigeCount,
			couponBalance: newCouponBalance,
			lifetimeCoupons: newLifetimeCoupons,
			nuclearPastaProducedThisRun: bigNumZero,
		},
		timeWarpCount: state.timeWarpCount,
		lastSavedAt: Date.now(),
	};
};
