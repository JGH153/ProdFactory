import { type BigNum, bigNum, bnMul } from "@/lib/big-number";
import { getPrestigePassiveMultiplier } from "./prestige-config";
import {
	getResearchMultiplier,
	getSpeedResearchMultiplier,
} from "./research-config";
import { getContinuousMultiplier, getRunTimeMultiplier } from "./run-timing";
import type { GameState, ResourceId } from "./types";

type ProductionParams = {
	productionMul: number;
	continuousMul: number;
	researchMul: number;
	prestigeMul: number;
	runTimeMultiplier: number;
	perRun: BigNum;
};

/** Compute all production multipliers for a resource from full GameState. */
export const getProductionParams = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): ProductionParams => {
	const resource = state.resources[resourceId];
	const runTimeMultiplier = getRunTimeMultiplier({
		shopBoosts: state.shopBoosts,
		isAutomated: resource.isAutomated && !resource.isPaused,
		speedResearchMultiplier: getSpeedResearchMultiplier({
			research: state.research,
			resourceId,
		}),
	});
	const productionMul = state.shopBoosts["production-20x"] ? 20 : 1;
	const continuousMul = getContinuousMultiplier({
		resourceId,
		producers: resource.producers,
		runTimeMultiplier,
	});
	const researchMul = getResearchMultiplier({
		research: state.research,
		resourceId,
	});
	const prestigeMul = getPrestigePassiveMultiplier({
		lifetimeCoupons: state.prestige.lifetimeCoupons,
	});

	return {
		productionMul,
		continuousMul,
		researchMul,
		prestigeMul,
		runTimeMultiplier,
		perRun: getPerRunProduction({
			producers: resource.producers,
			productionMul,
			continuousMul,
			researchMul,
			prestigeMul,
		}),
	};
};

/** Compute per-run production from individual multipliers. */
const getPerRunProduction = ({
	producers,
	productionMul,
	continuousMul,
	researchMul,
	prestigeMul,
}: {
	producers: number;
	productionMul: number;
	continuousMul: number;
	researchMul: number;
	prestigeMul: number;
}): BigNum =>
	bnMul(
		bnMul(bigNum(producers * productionMul), bigNum(continuousMul)),
		bigNum(researchMul * prestigeMul),
	);

/**
 * Compute total production for multiple runs.
 * Used by offline-progress and plausibility where continuous mode is
 * already embedded in the run time (pass continuousMul=1 implicitly).
 */
export const getProductionForRuns = ({
	runs,
	producers,
	productionMul,
	researchMul,
	prestigeMul,
}: {
	runs: number;
	producers: number;
	productionMul: number;
	researchMul: number;
	prestigeMul: number;
}): BigNum =>
	bigNum(runs * producers * productionMul * researchMul * prestigeMul);
