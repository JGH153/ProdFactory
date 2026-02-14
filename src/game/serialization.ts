import {
	bnDeserialize,
	bnSerialize,
	type SerializedBigNum,
} from "@/lib/big-number";
import { RESOURCE_ORDER } from "./config";
import { createInitialGameState } from "./initial-state";
import type { GameState, ResourceId, ResourceState, ShopBoosts } from "./types";

export const SAVE_VERSION = 3;

export type SerializedResourceState = {
	id: ResourceId;
	amount: SerializedBigNum;
	producers: number;
	isUnlocked: boolean;
	isAutomated: boolean;
	isPaused?: boolean;
	runStartedAt: number | null;
};

export type SerializedGameState = {
	resources: Record<ResourceId, SerializedResourceState>;
	shopBoosts?: ShopBoosts;
	lastSavedAt: number;
	version: number;
};

const serializeResource = (
	resource: ResourceState,
): SerializedResourceState => ({
	id: resource.id,
	amount: bnSerialize(resource.amount),
	producers: resource.producers,
	isUnlocked: resource.isUnlocked,
	isAutomated: resource.isAutomated,
	isPaused: resource.isPaused,
	runStartedAt: resource.runStartedAt,
});

const deserializeResource = (data: SerializedResourceState): ResourceState => ({
	id: data.id,
	amount: bnDeserialize(data.amount),
	producers: data.producers,
	isUnlocked: data.isUnlocked,
	isAutomated: data.isAutomated,
	isPaused: data.isPaused ?? false,
	runStartedAt: data.runStartedAt,
});

export const serializeGameState = (state: GameState): SerializedGameState => {
	const resources = {} as Record<ResourceId, SerializedResourceState>;
	for (const id of RESOURCE_ORDER) {
		resources[id] = serializeResource(state.resources[id]);
	}
	return {
		resources,
		shopBoosts: state.shopBoosts,
		lastSavedAt: Date.now(),
		version: SAVE_VERSION,
	};
};

export const deserializeGameState = (data: SerializedGameState): GameState => {
	const initialState = createInitialGameState();
	const resources = {} as Record<ResourceId, ResourceState>;
	for (const id of RESOURCE_ORDER) {
		if (data.resources[id]) {
			resources[id] = deserializeResource(data.resources[id]);
		} else {
			resources[id] = initialState.resources[id];
		}
	}
	return {
		resources,
		shopBoosts: data.shopBoosts ?? createInitialGameState().shopBoosts,
		lastSavedAt: data.lastSavedAt,
	};
};
