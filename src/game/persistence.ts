import {
	bnDeserialize,
	bnSerialize,
	type SerializedBigNum,
} from "@/lib/big-number";
import { RESOURCE_ORDER } from "./config";
import { createInitialGameState } from "./initial-state";
import type { GameState, ResourceId, ResourceState } from "./types";

const STORAGE_KEY = "prodfactory-save";
const SAVE_VERSION = 3;

type SerializedResourceState = {
	id: ResourceId;
	amount: SerializedBigNum;
	producers: number;
	isUnlocked: boolean;
	isAutomated: boolean;
	runStartedAt: number | null;
};

type SerializedGameState = {
	resources: Record<ResourceId, SerializedResourceState>;
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
	runStartedAt: resource.runStartedAt,
});

const deserializeResource = (data: SerializedResourceState): ResourceState => ({
	id: data.id,
	amount: bnDeserialize(data.amount),
	producers: data.producers,
	isUnlocked: data.isUnlocked,
	isAutomated: data.isAutomated,
	runStartedAt: data.runStartedAt,
});

const serializeGameState = (state: GameState): SerializedGameState => {
	const resources = {} as Record<ResourceId, SerializedResourceState>;
	for (const id of RESOURCE_ORDER) {
		resources[id] = serializeResource(state.resources[id]);
	}
	return {
		resources,
		lastSavedAt: Date.now(),
		version: SAVE_VERSION,
	};
};

const deserializeGameState = (data: SerializedGameState): GameState => {
	const resources = {} as Record<ResourceId, ResourceState>;
	for (const id of RESOURCE_ORDER) {
		resources[id] = deserializeResource(data.resources[id]);
	}
	return {
		resources,
		lastSavedAt: data.lastSavedAt,
	};
};

export const saveGame = (state: GameState): void => {
	try {
		const serialized = serializeGameState(state);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
	} catch {
		// Silently fail — localStorage might be full or unavailable
	}
};

export const loadGame = (): GameState => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return createInitialGameState();
		}
		const parsed = JSON.parse(raw) as SerializedGameState;
		if (parsed.version !== SAVE_VERSION) {
			return createInitialGameState();
		}
		return deserializeGameState(parsed);
	} catch {
		return createInitialGameState();
	}
};

export const clearSave = (): void => {
	localStorage.removeItem(STORAGE_KEY);
};
