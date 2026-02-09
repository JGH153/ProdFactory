import type { BigNum } from "@/lib/big-number";

export type ResourceId =
	| "iron-ore"
	| "plates"
	| "reinforced-plate"
	| "modular-frame";

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
	runStartedAt: number | null;
};

export type GameState = {
	resources: Record<ResourceId, ResourceState>;
	lastSavedAt: number;
};
