import type { AchievementState } from "./achievement-types";
import {
	ACHIEVEMENT_IDS,
	createInitialAchievementState,
} from "./achievement-types";

const STORAGE_KEY = "prodfactory-achievements";

export const loadLocalAchievements = (): AchievementState | null => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Partial<AchievementState>;
		// Ensure all achievement IDs are present (forward-compatible)
		const state = createInitialAchievementState();
		for (const id of ACHIEVEMENT_IDS) {
			if (parsed[id] === true) {
				state[id] = true;
			}
		}
		return state;
	} catch {
		return null;
	}
};

export const saveLocalAchievements = (achievements: AchievementState): void => {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(achievements));
	} catch {
		// Storage full or unavailable — silently ignore
	}
};
