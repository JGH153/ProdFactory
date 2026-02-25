import { RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { LAB_ORDER, RESEARCH_ORDER } from "@/game/research-config";
import type {
	GameState,
	LabId,
	LabState,
	OfflineSummary,
	ResearchId,
	ResourceId,
	ResourceState,
	ShopBoosts,
} from "@/game/types";
import {
	bnDeserialize,
	bnSerialize,
	type SerializedBigNum,
} from "@/lib/big-number";
import type { SerializedOfflineSummary } from "@/lib/server/offline-progress";

export const SAVE_VERSION = 5;

export type SerializedResourceState = {
	id: ResourceId;
	amount: SerializedBigNum;
	producers: number;
	isUnlocked: boolean;
	isAutomated: boolean;
	isPaused?: boolean;
	runStartedAt: number | null;
};

export type SerializedLabState = {
	isUnlocked: boolean;
	activeResearchId: ResearchId | null;
	researchStartedAt: number | null;
};

export type SerializedGameState = {
	resources: Record<ResourceId, SerializedResourceState>;
	shopBoosts?: ShopBoosts | undefined;
	labs?: Record<LabId, SerializedLabState> | undefined;
	research?: Record<ResearchId, number> | undefined;
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

const serializeLab = (lab: LabState): SerializedLabState => ({
	isUnlocked: lab.isUnlocked,
	activeResearchId: lab.activeResearchId,
	researchStartedAt: lab.researchStartedAt,
});

const deserializeLab = (data: SerializedLabState): LabState => ({
	isUnlocked: data.isUnlocked,
	activeResearchId: data.activeResearchId,
	researchStartedAt: data.researchStartedAt,
});

export const serializeGameState = (state: GameState): SerializedGameState => {
	const resources = {} as Record<ResourceId, SerializedResourceState>;
	for (const id of RESOURCE_ORDER) {
		resources[id] = serializeResource(state.resources[id]);
	}
	const labs = {} as Record<LabId, SerializedLabState>;
	for (const id of LAB_ORDER) {
		labs[id] = serializeLab(state.labs[id]);
	}
	return {
		resources,
		shopBoosts: state.shopBoosts,
		labs,
		research: { ...state.research },
		lastSavedAt: Date.now(),
		version: SAVE_VERSION,
	};
};

export const deserializeOfflineSummary = (
	summary: SerializedOfflineSummary,
): OfflineSummary => ({
	elapsedSeconds: summary.elapsedSeconds,
	gains: summary.gains.map(({ resourceId, amount }) => ({
		resourceId,
		amount: bnDeserialize(amount),
	})),
	researchLevelUps: summary.researchLevelUps ?? [],
	wasCapped: summary.wasCapped,
});

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
	const labs = {} as Record<LabId, LabState>;
	for (const id of LAB_ORDER) {
		if (data.labs?.[id]) {
			labs[id] = deserializeLab(data.labs[id]);
		} else {
			labs[id] = initialState.labs[id];
		}
	}
	const research = {} as Record<ResearchId, number>;
	for (const id of RESEARCH_ORDER) {
		research[id] = data.research?.[id] ?? 0;
	}
	return {
		resources,
		shopBoosts: data.shopBoosts ?? initialState.shopBoosts,
		labs,
		research,
		lastSavedAt: data.lastSavedAt,
	};
};
