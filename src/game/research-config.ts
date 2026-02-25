import type { LabId, ResearchId, ResourceId, ShopBoosts } from "./types";

export const MAX_RESEARCH_LEVEL = 10;
const RESEARCH_BASE_TIME = 10;
export const RESEARCH_BONUS_PER_LEVEL = 0.1;

export type ResearchConfig = {
	id: ResearchId;
	name: string;
	description: string;
	resourceId: ResourceId;
};

export const RESEARCH_CONFIGS: Record<ResearchId, ResearchConfig> = {
	"more-iron-ore": {
		id: "more-iron-ore",
		name: "Iron Ore Efficiency",
		description: "Increase Iron Ore production per run",
		resourceId: "iron-ore",
	},
	"more-plates": {
		id: "more-plates",
		name: "Plate Efficiency",
		description: "Increase Plates production per run",
		resourceId: "plates",
	},
	"more-reinforced-plate": {
		id: "more-reinforced-plate",
		name: "Reinforced Plate Efficiency",
		description: "Increase Reinforced Plate production per run",
		resourceId: "reinforced-plate",
	},
	"more-modular-frame": {
		id: "more-modular-frame",
		name: "Modular Frame Efficiency",
		description: "Increase Modular Frame production per run",
		resourceId: "modular-frame",
	},
	"more-heavy-modular-frame": {
		id: "more-heavy-modular-frame",
		name: "Heavy Frame Efficiency",
		description: "Increase Heavy Modular Frame production per run",
		resourceId: "heavy-modular-frame",
	},
	"more-fused-modular-frame": {
		id: "more-fused-modular-frame",
		name: "Fused Frame Efficiency",
		description: "Increase Fused Modular Frame production per run",
		resourceId: "fused-modular-frame",
	},
	"more-pressure-conversion-cube": {
		id: "more-pressure-conversion-cube",
		name: "Conversion Cube Efficiency",
		description: "Increase Pressure Conversion Cube production per run",
		resourceId: "pressure-conversion-cube",
	},
	"more-nuclear-pasta": {
		id: "more-nuclear-pasta",
		name: "Nuclear Pasta Efficiency",
		description: "Increase Nuclear Pasta production per run",
		resourceId: "nuclear-pasta",
	},
};

export const RESEARCH_ORDER: ResearchId[] = [
	"more-iron-ore",
	"more-plates",
	"more-reinforced-plate",
	"more-modular-frame",
	"more-heavy-modular-frame",
	"more-fused-modular-frame",
	"more-pressure-conversion-cube",
	"more-nuclear-pasta",
];

export const LAB_ORDER: LabId[] = ["lab-1", "lab-2"];

const RESOURCE_TO_RESEARCH: Record<ResourceId, ResearchId> = {
	"iron-ore": "more-iron-ore",
	plates: "more-plates",
	"reinforced-plate": "more-reinforced-plate",
	"modular-frame": "more-modular-frame",
	"heavy-modular-frame": "more-heavy-modular-frame",
	"fused-modular-frame": "more-fused-modular-frame",
	"pressure-conversion-cube": "more-pressure-conversion-cube",
	"nuclear-pasta": "more-nuclear-pasta",
};

/** Time in seconds to research from `level` to `level + 1`. */
export const getResearchTime = (level: number): number =>
	RESEARCH_BASE_TIME * 2 ** level;

/** Research time multiplier from shop boosts (0.5 when research-2x is active). */
export const getResearchTimeMultiplier = ({
	shopBoosts,
}: {
	shopBoosts: ShopBoosts;
}): number => (shopBoosts["research-2x"] ? 0.5 : 1);

/** Production multiplier from research for a given resource. */
export const getResearchMultiplier = ({
	research,
	resourceId,
}: {
	research: Record<ResearchId, number>;
	resourceId: ResourceId;
}): number => {
	const researchId = RESOURCE_TO_RESEARCH[resourceId];
	const level = research[researchId];
	return 1 + level * RESEARCH_BONUS_PER_LEVEL;
};
