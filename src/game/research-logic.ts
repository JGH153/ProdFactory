import { advanceResearchLevels } from "./research-calculator";
import {
	getMaxLevelForResearch,
	getResearchTimeMultiplier,
	LAB_ORDER,
	RESEARCH_CONFIGS,
} from "./research-config";
import type { GameState, LabId, LabState, ResearchId } from "./types";

/** Check if a lab can be unlocked (not already unlocked). */
export const canUnlockLab = ({
	state,
	labId,
}: {
	state: GameState;
	labId: LabId;
}): boolean => !state.labs[labId].isUnlocked;

/** Unlock a lab (free for now). */
export const unlockLab = ({
	state,
	labId,
}: {
	state: GameState;
	labId: LabId;
}): GameState => {
	if (!canUnlockLab({ state, labId })) {
		return state;
	}

	return {
		...state,
		labs: {
			...state.labs,
			[labId]: {
				...state.labs[labId],
				isUnlocked: true,
			},
		},
	};
};

/** Return a descriptive error if research cannot be assigned, or null if allowed. */
export const getAssignResearchError = ({
	state,
	labId,
	researchId,
}: {
	state: GameState;
	labId: LabId;
	researchId: ResearchId;
}): string | null => {
	const lab = state.labs[labId];
	if (!lab.isUnlocked) {
		return "Lab is not unlocked";
	}
	if (lab.activeResearchId !== null) {
		return "Lab already has active research";
	}
	const config = RESEARCH_CONFIGS[researchId];
	if (config.resourceId !== null) {
		if (!state.resources[config.resourceId].isUnlocked) {
			return "Resource is not unlocked";
		}
	} else if (state.prestige.prestigeCount < 1) {
		return "Prestige required to unlock utility research";
	}
	if (state.research[researchId] >= getMaxLevelForResearch(researchId)) {
		return "Research is already at max level";
	}
	for (const otherLabId of LAB_ORDER) {
		if (otherLabId === labId) {
			continue;
		}
		if (state.labs[otherLabId].activeResearchId === researchId) {
			return "Research is already assigned to another lab";
		}
	}
	return null;
};

/** Check if a research can be assigned to a lab. */
export const canAssignResearch = ({
	state,
	labId,
	researchId,
}: {
	state: GameState;
	labId: LabId;
	researchId: ResearchId;
}): boolean => getAssignResearchError({ state, labId, researchId }) === null;

/** Assign a research to a lab. */
export const assignResearch = ({
	state,
	labId,
	researchId,
}: {
	state: GameState;
	labId: LabId;
	researchId: ResearchId;
}): GameState => {
	if (!canAssignResearch({ state, labId, researchId })) {
		return state;
	}

	return {
		...state,
		labs: {
			...state.labs,
			[labId]: {
				...state.labs[labId],
				activeResearchId: researchId,
				researchStartedAt: Date.now(),
			},
		},
	};
};

/** Unassign research from a lab. In-progress time is lost. */
export const unassignResearch = ({
	state,
	labId,
}: {
	state: GameState;
	labId: LabId;
}): GameState => {
	const lab = state.labs[labId];
	if (lab.activeResearchId === null) {
		return state;
	}

	return {
		...state,
		labs: {
			...state.labs,
			[labId]: {
				...state.labs[labId],
				activeResearchId: null,
				researchStartedAt: null,
			},
		},
	};
};

export type ResearchLevelUp = {
	researchId: ResearchId;
	newLevel: number;
};

type AdvanceResearchResult = {
	state: GameState;
	levelUps: ResearchLevelUp[];
};

/** Advance research for all active labs and report each level-up. */
export const advanceResearchWithReport = ({
	state,
	now,
}: {
	state: GameState;
	now: number;
}): AdvanceResearchResult => {
	let newState = state;
	const levelUps: ResearchLevelUp[] = [];
	const researchTimeMultiplier = getResearchTimeMultiplier({
		shopBoosts: state.shopBoosts,
	});

	for (const labId of LAB_ORDER) {
		const lab = newState.labs[labId];
		if (
			!lab.isUnlocked ||
			lab.activeResearchId === null ||
			lab.researchStartedAt === null
		) {
			continue;
		}

		const researchId = lab.activeResearchId;
		const startLevel = newState.research[researchId];
		const maxLevel = getMaxLevelForResearch(researchId);
		const { newLevel, remainingMs } = advanceResearchLevels({
			startLevel,
			elapsedMs: now - lab.researchStartedAt,
			researchTimeMultiplier,
			maxLevel,
		});

		if (newLevel > startLevel) {
			for (let lvl = startLevel + 1; lvl <= newLevel; lvl++) {
				levelUps.push({ researchId, newLevel: lvl });
			}

			const isMaxed = newLevel >= maxLevel;
			const updatedLab: LabState = isMaxed
				? {
						...lab,
						activeResearchId: null,
						researchStartedAt: null,
					}
				: {
						...lab,
						researchStartedAt: now - remainingMs,
					};

			newState = {
				...newState,
				research: { ...newState.research, [researchId]: newLevel },
				labs: { ...newState.labs, [labId]: updatedLab },
			};
		}
	}

	return { state: newState, levelUps };
};

/** Advance research for all active labs based on elapsed time. */
export const advanceResearch = ({
	state,
	now,
}: {
	state: GameState;
	now: number;
}): GameState => advanceResearchWithReport({ state, now }).state;

/** Reset all research levels to 0 and lock all labs. */
export const resetResearch = ({ state }: { state: GameState }): GameState => {
	const hasAnyResearch = Object.values(state.research).some(
		(level) => level > 0,
	);
	const hasAnyUnlockedLab = LAB_ORDER.some(
		(labId) => state.labs[labId].isUnlocked,
	);
	if (!hasAnyResearch && !hasAnyUnlockedLab) {
		return state;
	}

	return {
		...state,
		research: {
			"more-iron-ore": 0,
			"more-plates": 0,
			"more-reinforced-plate": 0,
			"more-modular-frame": 0,
			"more-heavy-modular-frame": 0,
			"more-fused-modular-frame": 0,
			"more-pressure-conversion-cube": 0,
			"more-nuclear-pasta": 0,
			"speed-iron-ore": 0,
			"speed-plates": 0,
			"speed-reinforced-plate": 0,
			"speed-modular-frame": 0,
			"speed-heavy-modular-frame": 0,
			"speed-fused-modular-frame": 0,
			"speed-pressure-conversion-cube": 0,
			"speed-nuclear-pasta": 0,
			"offline-progress": 0,
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
	};
};
