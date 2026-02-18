import {
	type BigNum,
	bigNum,
	bnAdd,
	bnFloor,
	bnGte,
	bnIsZero,
	bnMul,
	bnPow,
	bnSub,
} from "@/lib/big-number";
import { RESOURCE_CONFIGS } from "./config";
import type {
	GameState,
	ResourceId,
	ResourceState,
	ShopBoostId,
	ShopBoosts,
} from "./types";

export const SPEED_MILESTONE_INTERVAL = 10;
const CONTINUOUS_THRESHOLD = 0.5;

/** Compute run time multiplier from active shop boosts */
export const getRunTimeMultiplier = ({
	shopBoosts,
	isAutomated,
}: {
	shopBoosts: ShopBoosts;
	isAutomated: boolean;
}): number => {
	let m = 1;
	if (shopBoosts["runtime-50"]) {
		m *= 0.5;
	}
	if (shopBoosts["automation-2x"] && isAutomated) {
		m *= 0.5;
	}
	return m;
};

/** Get effective run time after speed milestones (halves every 10 producers) */
export const getEffectiveRunTime = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): number => {
	const config = RESOURCE_CONFIGS[resourceId];
	const speedDoublings = Math.floor(producers / SPEED_MILESTONE_INTERVAL);
	return (config.baseRunTime / 2 ** speedDoublings) * runTimeMultiplier;
};

/** Whether a resource is in continuous mode (effective run time below threshold) */
export const isContinuousMode = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): boolean =>
	getEffectiveRunTime({ resourceId, producers, runTimeMultiplier }) <
	CONTINUOUS_THRESHOLD;

/** Multiplier to compensate for clamped tick rate in continuous mode */
export const getContinuousMultiplier = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): number => {
	const effective = getEffectiveRunTime({
		resourceId,
		producers,
		runTimeMultiplier,
	});
	if (effective >= CONTINUOUS_THRESHOLD) {
		return 1;
	}
	return CONTINUOUS_THRESHOLD / effective;
};

/** Run time clamped to continuous threshold minimum */
export const getClampedRunTime = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): number =>
	Math.max(
		getEffectiveRunTime({ resourceId, producers, runTimeMultiplier }),
		CONTINUOUS_THRESHOLD,
	);

/** Get speed milestone info for a resource */
export const getSpeedMilestone = (
	producers: number,
): { current: number; next: number; progress: number } => {
	const milestone = Math.floor(producers / SPEED_MILESTONE_INTERVAL);
	const next = (milestone + 1) * SPEED_MILESTONE_INTERVAL;
	const progressInMilestone =
		(producers % SPEED_MILESTONE_INTERVAL) / SPEED_MILESTONE_INTERVAL;
	return { current: producers, next, progress: progressInMilestone };
};

/** Calculate cost to buy the next producer */
export const getProducerCost = ({
	resourceId,
	owned,
}: {
	resourceId: ResourceId;
	owned: number;
}): BigNum => {
	const config = RESOURCE_CONFIGS[resourceId];
	return bnFloor(
		bnMul(config.baseCost, bnPow(bigNum(config.costScaling), owned)),
	);
};

/** Check if player can afford to buy a producer */
export const canBuyProducer = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): boolean => {
	const resource = state.resources[resourceId];
	if (!resource.isUnlocked) {
		return false;
	}
	const cost = getProducerCost({ resourceId, owned: resource.producers });
	return bnGte(resource.amount, cost);
};

/** Buy a producer, returning new state */
export const buyProducer = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	if (!canBuyProducer({ state, resourceId })) {
		return state;
	}

	const resource = state.resources[resourceId];
	const cost = getProducerCost({ resourceId, owned: resource.producers });

	return {
		...state,
		resources: {
			...state.resources,
			[resourceId]: {
				...resource,
				amount: bnSub(resource.amount, cost),
				producers: resource.producers + 1,
			},
		},
	};
};

/** Check if player can afford to unlock a resource */
export const canUnlock = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): boolean => {
	const config = RESOURCE_CONFIGS[resourceId];
	const resource = state.resources[resourceId];

	if (resource.isUnlocked) {
		return false;
	}
	if (config.unlockCost === null || config.unlockCostResourceId === null) {
		return false;
	}

	const payingResource = state.resources[config.unlockCostResourceId];
	return bnGte(payingResource.amount, config.unlockCost);
};

/** Unlock a resource, returning new state. Gives 1 free producer. */
export const unlockResource = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	if (!canUnlock({ state, resourceId })) {
		return state;
	}

	const config = RESOURCE_CONFIGS[resourceId];
	const resource = state.resources[resourceId];

	// Guaranteed non-null by canUnlock check above
	if (config.unlockCost === null || config.unlockCostResourceId === null) {
		return state;
	}

	const unlockCost = config.unlockCost;
	const payingResourceId = config.unlockCostResourceId;
	const payingResource = state.resources[payingResourceId];

	return {
		...state,
		resources: {
			...state.resources,
			[payingResourceId]: {
				...payingResource,
				amount: bnSub(payingResource.amount, unlockCost),
			},
			[resourceId]: {
				...resource,
				isUnlocked: true,
				producers: 1,
			},
		},
	};
};

/** Check if a run can be started */
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
		const rtm = getRunTimeMultiplier({
			shopBoosts: state.shopBoosts,
			isAutomated: resource.isAutomated && !resource.isPaused,
		});
		const multiplier = getContinuousMultiplier({
			resourceId,
			producers: resource.producers,
			runTimeMultiplier: rtm,
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
		const rtm = getRunTimeMultiplier({
			shopBoosts: state.shopBoosts,
			isAutomated: resource.isAutomated && !resource.isPaused,
		});
		const multiplier = getContinuousMultiplier({
			resourceId,
			producers: resource.producers,
			runTimeMultiplier: rtm,
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

/** Check if a run has completed */
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

	const rtm = getRunTimeMultiplier({
		shopBoosts: state.shopBoosts,
		isAutomated: resource.isAutomated && !resource.isPaused,
	});
	const continuousMul = getContinuousMultiplier({
		resourceId,
		producers: resource.producers,
		runTimeMultiplier: rtm,
	});
	const productionMul = state.shopBoosts["production-20x"] ? 20 : 1;
	const produced = bnMul(
		bigNum(resource.producers * productionMul),
		bigNum(continuousMul),
	);

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
	};
};

/** Check if player can afford to buy automation */
export const canBuyAutomation = ({
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
	if (resource.isAutomated) {
		return false;
	}

	return bnGte(resource.amount, config.automationCost);
};

/** Buy automation for a resource */
export const buyAutomation = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	if (!canBuyAutomation({ state, resourceId })) {
		return state;
	}

	const config = RESOURCE_CONFIGS[resourceId];
	const resource = state.resources[resourceId];

	return {
		...state,
		resources: {
			...state.resources,
			[resourceId]: {
				...resource,
				amount: bnSub(resource.amount, config.automationCost),
				isAutomated: true,
			},
		},
	};
};

/** Toggle pause state for an automated resource */
export const togglePause = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	const resource = state.resources[resourceId];
	if (!resource.isAutomated) {
		return state;
	}

	return {
		...state,
		resources: {
			...state.resources,
			[resourceId]: {
				...resource,
				isPaused: !resource.isPaused,
			},
		},
	};
};

/** Calculate how many producers the player can afford to buy */
export const getMaxAffordableProducers = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): number => {
	const resource = state.resources[resourceId];
	if (!resource.isUnlocked) {
		return 0;
	}

	let remaining = resource.amount;
	let owned = resource.producers;
	let count = 0;

	while (true) {
		const cost = getProducerCost({ resourceId, owned });
		if (!bnGte(remaining, cost)) {
			break;
		}
		remaining = bnSub(remaining, cost);
		owned += 1;
		count += 1;
	}

	return count;
};

/** Buy as many producers as the player can afford */
export const buyMaxProducers = ({
	state,
	resourceId,
}: {
	state: GameState;
	resourceId: ResourceId;
}): GameState => {
	let current = state;
	while (canBuyProducer({ state: current, resourceId })) {
		current = buyProducer({ state: current, resourceId });
	}
	return current;
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

/** Activate a shop boost */
export const activateBoost = ({
	state,
	boostId,
}: {
	state: GameState;
	boostId: ShopBoostId;
}): GameState => {
	if (state.shopBoosts[boostId]) {
		return state;
	}
	return {
		...state,
		shopBoosts: { ...state.shopBoosts, [boostId]: true },
	};
};

/** Reset all shop boosts to inactive */
export const resetShopBoosts = ({ state }: { state: GameState }): GameState => {
	const hasActiveBoost = Object.values(state.shopBoosts).some(Boolean);
	if (!hasActiveBoost) {
		return state;
	}
	return {
		...state,
		shopBoosts: {
			"production-20x": false,
			"automation-2x": false,
			"runtime-50": false,
		},
	};
};
