import type { BigNum } from "@/lib/big-number";

export type ResourceId =
	| "iron-ore"
	| "plates"
	| "reinforced-plate"
	| "modular-frame"
	| "heavy-modular-frame"
	| "fused-modular-frame"
	| "pressure-conversion-cube"
	| "nuclear-pasta";

export type ResearchId =
	| "more-iron-ore"
	| "more-plates"
	| "more-reinforced-plate"
	| "more-modular-frame"
	| "more-heavy-modular-frame"
	| "more-fused-modular-frame"
	| "more-pressure-conversion-cube"
	| "more-nuclear-pasta";

export type LabId = "lab-1" | "lab-2";

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

export type LabState = {
	isUnlocked: boolean;
	activeResearchId: ResearchId | null;
	researchStartedAt: number | null;
};

export type ShopBoostId =
	| "production-20x"
	| "automation-2x"
	| "runtime-50"
	| "research-2x";

export type ShopBoosts = Record<ShopBoostId, boolean>;

export type GameState = {
	resources: Record<ResourceId, ResourceState>;
	shopBoosts: ShopBoosts;
	labs: Record<LabId, LabState>;
	research: Record<ResearchId, number>;
	lastSavedAt: number;
};

export type OfflineResearchLevelUp = {
	researchId: ResearchId;
	newLevel: number;
};

export type OfflineSummary = {
	elapsedSeconds: number;
	gains: { resourceId: ResourceId; amount: BigNum }[];
	researchLevelUps: OfflineResearchLevelUp[];
	wasCapped: boolean;
};
