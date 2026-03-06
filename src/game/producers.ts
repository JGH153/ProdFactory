import {
	type BigNum,
	bigNum,
	bnDiv,
	bnFloor,
	bnGte,
	bnLog10,
	bnMul,
	bnPow,
	bnSub,
} from "@/lib/big-number";
import { RESOURCE_CONFIGS } from "./config";
import { getEffectiveCostScaling } from "./coupon-shop-config";
import type { GameState, ResourceId } from "./types";

const getScaling = ({
	resourceId,
	producerDiscountLevel = 0,
}: {
	resourceId: ResourceId;
	producerDiscountLevel?: number;
}): number => {
	const config = RESOURCE_CONFIGS[resourceId];
	return producerDiscountLevel > 0
		? getEffectiveCostScaling({ level: producerDiscountLevel })
		: config.costScaling;
};

export const getProducerCost = ({
	resourceId,
	owned,
	producerDiscountLevel = 0,
}: {
	resourceId: ResourceId;
	owned: number;
	producerDiscountLevel?: number;
}): BigNum => {
	const config = RESOURCE_CONFIGS[resourceId];
	const scaling = getScaling({ resourceId, producerDiscountLevel });
	return bnFloor(bnMul(config.baseCost, bnPow(bigNum(scaling), owned)));
};

/**
 * Compute the total cost of buying `count` producers starting from `owned`.
 * Uses the geometric series: baseCost * scaling^owned * (scaling^count - 1) / (scaling - 1)
 */
const getProducerBulkCost = ({
	resourceId,
	owned,
	count,
	producerDiscountLevel = 0,
}: {
	resourceId: ResourceId;
	owned: number;
	count: number;
	producerDiscountLevel?: number;
}): BigNum => {
	if (count <= 0) {
		return bigNum(0);
	}
	const config = RESOURCE_CONFIGS[resourceId];
	const scaling = getScaling({ resourceId, producerDiscountLevel });
	// sum = baseCost * (scaling^(owned+count) - scaling^owned) / (scaling - 1)
	const scalePowEnd = bnPow(bigNum(scaling), owned + count);
	const scalePowStart = bnPow(bigNum(scaling), owned);
	const numerator = bnMul(config.baseCost, bnSub(scalePowEnd, scalePowStart));
	return bnFloor(bnDiv(numerator, bigNum(scaling - 1)));
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
	const cost = getProducerCost({
		resourceId,
		owned: resource.producers,
		producerDiscountLevel: state.couponUpgrades["producer-discount"],
	});
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
	const cost = getProducerCost({
		resourceId,
		owned: resource.producers,
		producerDiscountLevel: state.couponUpgrades["producer-discount"],
	});

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

/**
 * O(1) computation of max affordable producers using geometric series math.
 *
 * Total cost for `count` producers starting at `owned`:
 *   totalCost = baseCost * scaling^owned * (scaling^count - 1) / (scaling - 1)
 *
 * Solving for count:
 *   count = floor(log(amount * (scaling - 1) / (baseCost * scaling^owned) + 1) / log(scaling))
 *
 * A verification step adjusts for floating-point drift.
 */
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

	const producerDiscountLevel = state.couponUpgrades["producer-discount"];
	const firstCost = getProducerCost({
		resourceId,
		owned: resource.producers,
		producerDiscountLevel,
	});

	if (!bnGte(resource.amount, firstCost)) {
		return 0;
	}

	const config = RESOURCE_CONFIGS[resourceId];
	const scaling = getScaling({ resourceId, producerDiscountLevel });
	const logScaling = Math.log10(scaling);

	// ratio = amount * (scaling - 1) / (baseCost * scaling^owned)
	// log10(ratio) = log10(amount) + log10(scaling - 1) - log10(baseCost) - owned * log10(scaling)
	const log10Ratio =
		bnLog10(resource.amount) +
		Math.log10(scaling - 1) -
		bnLog10(config.baseCost) -
		resource.producers * logScaling;

	// count = floor(log10(ratio + 1) / log10(scaling))
	// For large ratio (>10^15), log10(ratio + 1) ≈ log10(ratio), avoids Infinity overflow
	const log10RatioPlusOne =
		log10Ratio > 15 ? log10Ratio : Math.log10(10 ** log10Ratio + 1);
	const rawCount = Math.floor(log10RatioPlusOne / logScaling);
	let count = Math.max(0, rawCount);

	// Verify and adjust for floating-point drift (off by ±1)
	const bulkCost = getProducerBulkCost({
		resourceId,
		owned: resource.producers,
		count,
		producerDiscountLevel,
	});

	if (!bnGte(resource.amount, bulkCost)) {
		// Overshot — back off by 1
		count = Math.max(0, count - 1);
	} else {
		// Check if we can afford one more
		const nextCost = getProducerBulkCost({
			resourceId,
			owned: resource.producers,
			count: count + 1,
			producerDiscountLevel,
		});
		if (bnGte(resource.amount, nextCost)) {
			count += 1;
		}
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
	const resource = state.resources[resourceId];
	const producerDiscountLevel = state.couponUpgrades["producer-discount"];
	const count = getMaxAffordableProducers({ state, resourceId });

	if (count === 0) {
		return state;
	}

	const totalCost = getProducerBulkCost({
		resourceId,
		owned: resource.producers,
		count,
		producerDiscountLevel,
	});

	return {
		...state,
		resources: {
			...state.resources,
			[resourceId]: {
				...resource,
				amount: bnSub(resource.amount, totalCost),
				producers: resource.producers + count,
			},
		},
	};
};
