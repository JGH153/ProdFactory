import type { LabId, ResearchId, ResourceId, ShopBoosts } from "./types";

export const MAX_RESEARCH_LEVEL = 10;
const MAX_UTILITY_RESEARCH_LEVEL = 12;
const RESEARCH_BASE_TIME = 10;
export const RESEARCH_BONUS_PER_LEVEL = 0.1;
const BASE_OFFLINE_SECONDS = 8 * 3600;
const OFFLINE_BOOST_SECONDS = 2 * 3600;
export const OFFLINE_PROGRESS_BONUS_PER_LEVEL = 5 * 60;

export type ResearchConfig = {
	id: ResearchId;
	name: string;
	description: string;
	resourceId: ResourceId | null;
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
	"speed-iron-ore": {
		id: "speed-iron-ore",
		name: "Iron Ore Speed",
		description: "Decrease Iron Ore run time",
		resourceId: "iron-ore",
	},
	"speed-plates": {
		id: "speed-plates",
		name: "Plate Speed",
		description: "Decrease Plates run time",
		resourceId: "plates",
	},
	"speed-reinforced-plate": {
		id: "speed-reinforced-plate",
		name: "Reinforced Plate Speed",
		description: "Decrease Reinforced Plate run time",
		resourceId: "reinforced-plate",
	},
	"speed-modular-frame": {
		id: "speed-modular-frame",
		name: "Modular Frame Speed",
		description: "Decrease Modular Frame run time",
		resourceId: "modular-frame",
	},
	"speed-heavy-modular-frame": {
		id: "speed-heavy-modular-frame",
		name: "Heavy Frame Speed",
		description: "Decrease Heavy Modular Frame run time",
		resourceId: "heavy-modular-frame",
	},
	"speed-fused-modular-frame": {
		id: "speed-fused-modular-frame",
		name: "Fused Frame Speed",
		description: "Decrease Fused Modular Frame run time",
		resourceId: "fused-modular-frame",
	},
	"speed-pressure-conversion-cube": {
		id: "speed-pressure-conversion-cube",
		name: "Conversion Cube Speed",
		description: "Decrease Pressure Conversion Cube run time",
		resourceId: "pressure-conversion-cube",
	},
	"speed-nuclear-pasta": {
		id: "speed-nuclear-pasta",
		name: "Nuclear Pasta Speed",
		description: "Decrease Nuclear Pasta run time",
		resourceId: "nuclear-pasta",
	},
	"offline-progress": {
		id: "offline-progress",
		name: "Offline Progress",
		description: "Increase offline progress cap by 5 minutes",
		resourceId: null,
	},
};

export const EFFICIENCY_RESEARCH_ORDER: ResearchId[] = [
	"more-iron-ore",
	"more-plates",
	"more-reinforced-plate",
	"more-modular-frame",
	"more-heavy-modular-frame",
	"more-fused-modular-frame",
	"more-pressure-conversion-cube",
	"more-nuclear-pasta",
];

export const SPEED_RESEARCH_ORDER: ResearchId[] = [
	"speed-iron-ore",
	"speed-plates",
	"speed-reinforced-plate",
	"speed-modular-frame",
	"speed-heavy-modular-frame",
	"speed-fused-modular-frame",
	"speed-pressure-conversion-cube",
	"speed-nuclear-pasta",
];

export const UTILITY_RESEARCH_ORDER: ResearchId[] = ["offline-progress"];

export const RESEARCH_ORDER: ResearchId[] = [
	...EFFICIENCY_RESEARCH_ORDER,
	...SPEED_RESEARCH_ORDER,
	...UTILITY_RESEARCH_ORDER,
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

const RESOURCE_TO_SPEED_RESEARCH: Record<ResourceId, ResearchId> = {
	"iron-ore": "speed-iron-ore",
	plates: "speed-plates",
	"reinforced-plate": "speed-reinforced-plate",
	"modular-frame": "speed-modular-frame",
	"heavy-modular-frame": "speed-heavy-modular-frame",
	"fused-modular-frame": "speed-fused-modular-frame",
	"pressure-conversion-cube": "speed-pressure-conversion-cube",
	"nuclear-pasta": "speed-nuclear-pasta",
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

/** Run time multiplier from speed research for a given resource. Returns value <= 1. */
export const getSpeedResearchMultiplier = ({
	research,
	resourceId,
}: {
	research: Record<ResearchId, number>;
	resourceId: ResourceId;
}): number => {
	const researchId = RESOURCE_TO_SPEED_RESEARCH[resourceId];
	const level = research[researchId];
	return 1 / (1 + level * RESEARCH_BONUS_PER_LEVEL);
};

/** Whether a research ID belongs to the utility group. */
const isUtilityResearch = (researchId: ResearchId): boolean =>
	UTILITY_RESEARCH_ORDER.includes(researchId);

/** Max level for a given research (12 for utility, 10 for others). */
export const getMaxLevelForResearch = (researchId: ResearchId): number =>
	isUtilityResearch(researchId)
		? MAX_UTILITY_RESEARCH_LEVEL
		: MAX_RESEARCH_LEVEL;

/** Max offline progress cap in seconds, accounting for shop boost and research. */
export const getOfflineCapSeconds = ({
	shopBoosts,
	research,
}: {
	shopBoosts: ShopBoosts;
	research: Record<ResearchId, number>;
}): number => {
	let cap = BASE_OFFLINE_SECONDS;
	if (shopBoosts["offline-2h"]) {
		cap += OFFLINE_BOOST_SECONDS;
	}
	cap += research["offline-progress"] * OFFLINE_PROGRESS_BONUS_PER_LEVEL;
	return cap;
};
