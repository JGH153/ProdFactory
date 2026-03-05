import { RESOURCE_ORDER } from "@/game/config";
import type { CouponUpgradeId } from "@/game/coupon-shop-config";
import { COUPON_UPGRADE_ORDER } from "@/game/coupon-shop-config";
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
	lastPrestigeAt?: number | null;
};

export type SerializedGameState = {
	resources: Record<ResourceId, SerializedResourceState>;
	shopBoosts: ShopBoosts;
	labs: Record<LabId, SerializedLabState>;
	research: Record<ResearchId, number>;
	prestige: SerializedPrestigeState;
	couponUpgrades?: Record<CouponUpgradeId, number>;
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
	lastPrestigeAt: prestige.lastPrestigeAt,
});

const deserializePrestige = (data: SerializedPrestigeState): PrestigeState => ({
	prestigeCount: data.prestigeCount,
	couponBalance: bnDeserialize(data.couponBalance),
	lifetimeCoupons: bnDeserialize(data.lifetimeCoupons),
	nuclearPastaProducedThisRun: bnDeserialize(data.nuclearPastaProducedThisRun),
	lastPrestigeAt: data.lastPrestigeAt ?? null,
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
		couponUpgrades: { ...state.couponUpgrades },
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

export const migrateShopBoosts = (
	boosts: Record<string, boolean>,
): ShopBoosts => {
	if ("production-20x" in boosts) {
		const { "production-20x": oldValue, ...rest } = boosts;
		return { ...rest, "production-2x": oldValue } as ShopBoosts;
	}
	return boosts as ShopBoosts;
};

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
	const couponUpgrades: Record<CouponUpgradeId, number> = {
		"producer-discount": 0,
		"offline-capacity": 0,
		"coupon-magnet": 0,
		"speed-surge": 0,
	};
	if (data.couponUpgrades) {
		for (const id of COUPON_UPGRADE_ORDER) {
			couponUpgrades[id] = data.couponUpgrades[id] ?? 0;
		}
	}
	return {
		resources,
		shopBoosts: migrateShopBoosts(
			data.shopBoosts as unknown as Record<string, boolean>,
		),
		labs,
		research,
		prestige: deserializePrestige(data.prestige),
		couponUpgrades,
		timeWarpCount: data.timeWarpCount,
		lastSavedAt: data.lastSavedAt,
	};
};
