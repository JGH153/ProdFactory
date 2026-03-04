import { RESOURCE_ORDER } from "@/game/config";
import { LAB_ORDER, RESEARCH_ORDER } from "@/game/research-config";
import type {
	GameState,
	LabId,
	LabState,
	OfflineSummary,
	PrestigeState,
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

export const SAVE_VERSION = 1;

export type SerializedResourceState = {
	id: ResourceId;
	amount: SerializedBigNum;
	producers: number;
	isUnlocked: boolean;
	isAutomated: boolean;
	isPaused: boolean;
	runStartedAt: number | null;
};

export type SerializedLabState = {
	isUnlocked: boolean;
	activeResearchId: ResearchId | null;
	researchStartedAt: number | null;
};

export type SerializedPrestigeState = {
	prestigeCount: number;
	couponBalance: SerializedBigNum;
	lifetimeCoupons: SerializedBigNum;
	nuclearPastaProducedThisRun: SerializedBigNum;
};

export type SerializedGameState = {
	resources: Record<ResourceId, SerializedResourceState>;
	shopBoosts: ShopBoosts;
	labs: Record<LabId, SerializedLabState>;
	research: Record<ResearchId, number>;
	prestige: SerializedPrestigeState;
	timeWarpCount: number;
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
	isPaused: data.isPaused,
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

const serializePrestige = (
	prestige: PrestigeState,
): SerializedPrestigeState => ({
	prestigeCount: prestige.prestigeCount,
	couponBalance: bnSerialize(prestige.couponBalance),
	lifetimeCoupons: bnSerialize(prestige.lifetimeCoupons),
	nuclearPastaProducedThisRun: bnSerialize(
		prestige.nuclearPastaProducedThisRun,
	),
});

const deserializePrestige = (data: SerializedPrestigeState): PrestigeState => ({
	prestigeCount: data.prestigeCount,
	couponBalance: bnDeserialize(data.couponBalance),
	lifetimeCoupons: bnDeserialize(data.lifetimeCoupons),
	nuclearPastaProducedThisRun: bnDeserialize(data.nuclearPastaProducedThisRun),
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
		prestige: serializePrestige(state.prestige),
		timeWarpCount: state.timeWarpCount,
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
	researchLevelUps: summary.researchLevelUps,
	wasCapped: summary.wasCapped,
	isTimeWarp: summary.isTimeWarp,
});

export const deserializeGameState = (data: SerializedGameState): GameState => {
	const resources = {} as Record<ResourceId, ResourceState>;
	for (const id of RESOURCE_ORDER) {
		resources[id] = deserializeResource(data.resources[id]);
	}
	const labs = {} as Record<LabId, LabState>;
	for (const id of LAB_ORDER) {
		labs[id] = deserializeLab(data.labs[id]);
	}
	const research = {} as Record<ResearchId, number>;
	for (const id of RESEARCH_ORDER) {
		research[id] = data.research[id];
	}
	return {
		resources,
		shopBoosts: data.shopBoosts,
		labs,
		research,
		prestige: deserializePrestige(data.prestige),
		timeWarpCount: data.timeWarpCount,
		lastSavedAt: data.lastSavedAt,
	};
};
