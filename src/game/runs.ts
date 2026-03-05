import {
	type BigNum,
	bigNum,
	bnAdd,
	bnGte,
	bnIsZero,
	bnMul,
	bnSub,
} from "@/lib/big-number";
import { RESOURCE_CONFIGS } from "./config";
import { getProductionParams } from "./production";
import { getSpeedResearchMultiplier } from "./research-config";
import { getContinuousMultiplier, getRunTimeMultiplier } from "./run-timing";
import type { GameState, ResourceId, ResourceState } from "./types";

export const canStartRun = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): boolean => {
	const config = RESOURCE_CONFIGS[resourceId];
	const resource = state.resources[resourceId];

	if (!resource.isUnlocked) {
		return false;
	}
	if (resource.runStartedAt !== null) {
		return false;
	}

	// Check if we have enough input resources (multiplied in continuous mode)
	if (config.inputResourceId !== null && config.inputCostPerRun !== null) {
		const inputResource = state.resources[config.inputResourceId];
		const runTimeMultiplier = getRunTimeMultiplier({
			shopBoosts: state.shopBoosts,
			isAutomated: resource.isAutomated && !resource.isPaused,
			speedResearchMultiplier: getSpeedResearchMultiplier({
				research: state.research,
				resourceId,
			}),
			speedSurgeLevel: state.couponUpgrades["speed-surge"],
		});
		const multiplier = getContinuousMultiplier({
			resourceId,
			producers: resource.producers,
			runTimeMultiplier,
		});
		const totalInputCost = bnMul(
			bnMul(config.inputCostPerRun, bigNum(resource.producers)),
			bigNum(multiplier),
		);
		if (!bnGte(inputResource.amount, totalInputCost)) {
			return false;
		}
	}

	return true;
};

/** Start a run for a resource. Deducts input cost immediately. */
export const startRun = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	if (!canStartRun({ state, resourceId })) {
		return state;
	}

	const config = RESOURCE_CONFIGS[resourceId];
	const resource = state.resources[resourceId];
	let newResources = { ...state.resources };

	// Deduct input cost at run start (multiplied in continuous mode)
	if (config.inputResourceId !== null && config.inputCostPerRun !== null) {
		const inputResource = state.resources[config.inputResourceId];
		const runTimeMultiplier = getRunTimeMultiplier({
			shopBoosts: state.shopBoosts,
			isAutomated: resource.isAutomated && !resource.isPaused,
			speedResearchMultiplier: getSpeedResearchMultiplier({
				research: state.research,
				resourceId,
			}),
			speedSurgeLevel: state.couponUpgrades["speed-surge"],
		});
		const multiplier = getContinuousMultiplier({
			resourceId,
			producers: resource.producers,
			runTimeMultiplier,
		});
		const totalInputCost = bnMul(
			bnMul(config.inputCostPerRun, bigNum(resource.producers)),
			bigNum(multiplier),
		);
		newResources = {
			...newResources,
			[config.inputResourceId]: {
				...inputResource,
				amount: bnSub(inputResource.amount, totalInputCost),
			},
		};
	}

	newResources = {
		...newResources,
		[resourceId]: {
			...resource,
			runStartedAt: Date.now(),
		},
	};

	return { ...state, resources: newResources };
};

export const isRunComplete = ({
	resource,
	runTime,
}: {
	resource: ResourceState;
	runTime: number;
}): boolean => {
	if (resource.runStartedAt === null) {
		return false;
	}
	return Date.now() - resource.runStartedAt >= runTime * 1000;
};

/** Complete a run: award resources and reset timer */
export const completeRun = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	const resource = state.resources[resourceId];
	if (resource.runStartedAt === null) {
		return state;
	}

	const { perRun: produced } = getProductionParams({
		state,
		resourceId,
	});

	const updatedPrestige =
		resourceId === "nuclear-pasta"
			? {
					...state.prestige,
					nuclearPastaProducedThisRun: bnAdd(
						state.prestige.nuclearPastaProducedThisRun,
						produced,
					),
				}
			: state.prestige;

	return {
		...state,
		resources: {
			...state.resources,
			[resourceId]: {
				...resource,
				amount: bnAdd(resource.amount, produced),
				runStartedAt: null,
			},
		},
		prestige: updatedPrestige,
	};
};

/** Get total input cost for a run (scales with producers, multiplied in continuous mode) */
export const getRunInputCost = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): BigNum | null => {
	const config = RESOURCE_CONFIGS[resourceId];
	if (config.inputCostPerRun === null) {
		return null;
	}
	if (bnIsZero(config.inputCostPerRun)) {
		return null;
	}
	const multiplier = getContinuousMultiplier({
		resourceId,
		producers,
		runTimeMultiplier,
	});
	return bnMul(
		bnMul(config.inputCostPerRun, bigNum(producers)),
		bigNum(multiplier),
	);
};
