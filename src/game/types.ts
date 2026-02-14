import type { BigNum } from "@/lib/big-number";

export type ResourceId =
	| "iron-ore"
	| "plates"
	| "reinforced-plate"
	| "modular-frame"
	| "heavy-modular-frame"
	| "fused-modular-frame";

export type ResourceConfig = {
	id: ResourceId;
	name: string;
	description: string;
	baseRunTime: number;
	baseCost: BigNum;
	costScaling: number;
	unlockCost: BigNum | null;
	unlockCostResourceId: ResourceId | null;
	inputResourceId: ResourceId | null;
	inputCostPerRun: BigNum | null;
	automationCost: BigNum;
	tier: number;
};

export type ResourceState = {
	id: ResourceId;
	amount: BigNum;
	producers: number;
	isUnlocked: boolean;
	isAutomated: boolean;
	isPaused: boolean;
	runStartedAt: number | null;
};

export type ShopBoostId = "production-2x" | "automation-2x" | "runtime-50";

export type ShopBoosts = Record<ShopBoostId, boolean>;

export type GameState = {
	resources: Record<ResourceId, ResourceState>;
	shopBoosts: ShopBoosts;
	lastSavedAt: number;
};
