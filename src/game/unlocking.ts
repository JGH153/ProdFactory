import { bnGte, bnSub } from "@/lib/big-number";
import { RESOURCE_CONFIGS } from "./config";
import type { GameState, ResourceId } from "./types";

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
