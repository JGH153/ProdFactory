import type { SerializedGameState } from "@/game/state/serialization";
import type { LabId, ResearchId, ResourceId } from "@/game/types";

export const createInitialSerializedState = (): SerializedGameState => ({
	version: 5,
	lastSavedAt: Date.now(),
	resources: {
		"iron-ore": {
			id: "iron-ore",
			amount: { m: 0, e: 0 },
			producers: 1,
			isUnlocked: true,
			isAutomated: false,
			runStartedAt: null,
		},
		plates: {
			id: "plates",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"reinforced-plate": {
			id: "reinforced-plate",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"modular-frame": {
			id: "modular-frame",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"heavy-modular-frame": {
			id: "heavy-modular-frame",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"fused-modular-frame": {
			id: "fused-modular-frame",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"pressure-conversion-cube": {
			id: "pressure-conversion-cube",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"nuclear-pasta": {
			id: "nuclear-pasta",
			amount: { m: 0, e: 0 },
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
	},
	shopBoosts: {
		"production-20x": false,
		"automation-2x": false,
		"runtime-50": false,
		"research-2x": false,
	},
	labs: {
		"lab-1": {
			isUnlocked: false,
			activeResearchId: null,
			researchStartedAt: null,
		},
		"lab-2": {
			isUnlocked: false,
			activeResearchId: null,
			researchStartedAt: null,
		},
	},
	research: {
		"more-iron-ore": 0,
		"more-plates": 0,
		"more-reinforced-plate": 0,
		"more-modular-frame": 0,
		"more-heavy-modular-frame": 0,
		"more-fused-modular-frame": 0,
		"more-pressure-conversion-cube": 0,
		"more-nuclear-pasta": 0,
	},
});

type StateOverrides = {
	resources?: Partial<
		Record<ResourceId, Partial<SerializedGameState["resources"][ResourceId]>>
	>;
	shopBoosts?: Partial<SerializedGameState["shopBoosts"]>;
	labs?: Partial<
		Record<LabId, Partial<NonNullable<SerializedGameState["labs"]>[LabId]>>
	>;
	research?: Partial<Record<ResearchId, number>>;
};

export const createStateWith = (
	overrides: StateOverrides,
): SerializedGameState => {
	const base = createInitialSerializedState();
	if (overrides.resources) {
		for (const [id, changes] of Object.entries(overrides.resources)) {
			const resourceId = id as ResourceId;
			base.resources[resourceId] = {
				...base.resources[resourceId],
				...changes,
			};
		}
	}
	if (overrides.shopBoosts && base.shopBoosts) {
		Object.assign(base.shopBoosts, overrides.shopBoosts);
	}
	if (overrides.labs) {
		for (const [id, changes] of Object.entries(overrides.labs)) {
			const labId = id as LabId;
			if (base.labs) {
				base.labs[labId] = { ...base.labs[labId], ...changes };
			}
		}
	}
	if (overrides.research && base.research) {
		Object.assign(base.research, overrides.research);
	}
	return base;
};
