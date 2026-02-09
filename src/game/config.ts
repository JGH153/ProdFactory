import { bigNum } from "@/lib/big-number";
import type { ResourceConfig, ResourceId } from "./types";

const COST_SCALING = 1.15;

export const RESOURCE_CONFIGS: Record<ResourceId, ResourceConfig> = {
	"iron-ore": {
		id: "iron-ore",
		name: "Iron Ore",
		description: "The foundation of all production",
		baseRunTime: 1,
		baseCost: bigNum(2),
		costScaling: COST_SCALING,
		unlockCost: null,
		unlockCostResourceId: null,
		inputResourceId: null,
		inputCostPerRun: null,
		automationCost: bigNum(10),
		tier: 0,
	},
	plates: {
		id: "plates",
		name: "Plates",
		description: "Refined iron sheets",
		baseRunTime: 2,
		baseCost: bigNum(4),
		costScaling: COST_SCALING,
		unlockCost: bigNum(20),
		unlockCostResourceId: "iron-ore",
		inputResourceId: "iron-ore",
		inputCostPerRun: bigNum(4),
		automationCost: bigNum(10),
		tier: 1,
	},
	"reinforced-plate": {
		id: "reinforced-plate",
		name: "Reinforced Plate",
		description: "Iron plates reinforced with screws",
		baseRunTime: 4,
		baseCost: bigNum(8),
		costScaling: COST_SCALING,
		unlockCost: bigNum(20),
		unlockCostResourceId: "plates",
		inputResourceId: "plates",
		inputCostPerRun: bigNum(4),
		automationCost: bigNum(10),
		tier: 2,
	},
	"modular-frame": {
		id: "modular-frame",
		name: "Modular Frame",
		description: "A versatile structural component",
		baseRunTime: 8,
		baseCost: bigNum(16),
		costScaling: COST_SCALING,
		unlockCost: bigNum(20),
		unlockCostResourceId: "reinforced-plate",
		inputResourceId: "reinforced-plate",
		inputCostPerRun: bigNum(4),
		automationCost: bigNum(10),
		tier: 3,
	},
};

export const RESOURCE_ORDER: ResourceId[] = [
	"iron-ore",
	"plates",
	"reinforced-plate",
	"modular-frame",
];
