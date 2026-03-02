import { getResearchTime, MAX_RESEARCH_LEVEL } from "./research-config";

/**
 * Advance research levels given elapsed time.
 * Shared by research-logic (client game loop), offline-progress, and plausibility.
 */
export const advanceResearchLevels = ({
	startLevel,
	elapsedMs,
	researchTimeMultiplier,
}: {
	startLevel: number;
	elapsedMs: number;
	researchTimeMultiplier: number;
}): { newLevel: number; remainingMs: number } => {
	let level = startLevel;
	let remaining = elapsedMs;
	while (level < MAX_RESEARCH_LEVEL) {
		const levelTimeMs = getResearchTime(level) * 1000 * researchTimeMultiplier;
		if (remaining < levelTimeMs) {
			break;
		}
		remaining -= levelTimeMs;
		level++;
	}
	return { newLevel: level, remainingMs: remaining };
};
