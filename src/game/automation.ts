import { bnGte, bnSub } from "@/lib/big-number";
import { RESOURCE_CONFIGS } from "./config";
import type { GameState, ResourceId } from "./types";

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
