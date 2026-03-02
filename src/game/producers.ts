import {
	type BigNum,
	bigNum,
	bnFloor,
	bnGte,
	bnMul,
	bnPow,
	bnSub,
} from "@/lib/big-number";
import { RESOURCE_CONFIGS } from "./config";
import type { GameState, ResourceId } from "./types";

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
