import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./initial-state";
import {
	getResearchTime,
	getResearchTimeMultiplier,
	getSpeedResearchMultiplier,
	MAX_RESEARCH_LEVEL,
} from "./research-config";
import {
	advanceResearch,
	advanceResearchWithReport,
	assignResearch,
	canAssignResearch,
	canUnlockLab,
	getAssignResearchError,
	resetResearch,
	unassignResearch,
	unlockLab,
} from "./research-logic";
import type { GameState } from "./types";

const withUnlockedLab = (labId: "lab-1" | "lab-2"): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		labs: {
			...state.labs,
			[labId]: { ...state.labs[labId], isUnlocked: true },
		},
	};
};

const withBothLabsUnlocked = (): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		labs: {
			"lab-1": {
				isUnlocked: true,
				activeResearchId: null,
				researchStartedAt: null,
			},
			"lab-2": {
				isUnlocked: true,
				activeResearchId: null,
				researchStartedAt: null,
			},
		},
	};
};

describe("unlockLab", () => {
	it("unlocks a locked lab", () => {
		const state = createInitialGameState();
		const result = unlockLab({ state, labId: "lab-1" });
		expect(result.labs["lab-1"].isUnlocked).toBe(true);
	});

	it("returns same state if already unlocked", () => {
		const state = withUnlockedLab("lab-1");
		const result = unlockLab({ state, labId: "lab-1" });
		expect(result).toBe(state);
	});
});

describe("canUnlockLab", () => {
	it("returns true for locked lab", () => {
		const state = createInitialGameState();
		expect(canUnlockLab({ state, labId: "lab-1" })).toBe(true);
	});

	it("returns false for unlocked lab", () => {
		const state = withUnlockedLab("lab-1");
		expect(canUnlockLab({ state, labId: "lab-1" })).toBe(false);
	});
});

describe("canAssignResearch", () => {
	it("returns true for unlocked idle lab with valid research", () => {
		const state = withUnlockedLab("lab-1");
		expect(
			canAssignResearch({ state, labId: "lab-1", researchId: "more-iron-ore" }),
		).toBe(true);
	});

	it("returns false for locked lab", () => {
		const state = createInitialGameState();
		expect(
			canAssignResearch({ state, labId: "lab-1", researchId: "more-iron-ore" }),
		).toBe(false);
	});

	it("returns false if lab already has active research", () => {
		const state = withUnlockedLab("lab-1");
		const assigned = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		expect(
			canAssignResearch({
				state: assigned,
				labId: "lab-1",
				researchId: "more-plates",
			}),
		).toBe(false);
	});

	it("returns false for locked resource", () => {
		const state = withUnlockedLab("lab-1");
		expect(
			canAssignResearch({
				state,
				labId: "lab-1",
				researchId: "more-plates",
			}),
		).toBe(false);
	});

	it("returns false if research is at max level", () => {
		const state = withUnlockedLab("lab-1");
		const maxed: GameState = {
			...state,
			research: { ...state.research, "more-iron-ore": MAX_RESEARCH_LEVEL },
		};
		expect(
			canAssignResearch({
				state: maxed,
				labId: "lab-1",
				researchId: "more-iron-ore",
			}),
		).toBe(false);
	});

	it("returns false if research is assigned to another lab", () => {
		const state = withBothLabsUnlocked();
		const assigned = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		expect(
			canAssignResearch({
				state: assigned,
				labId: "lab-2",
				researchId: "more-iron-ore",
			}),
		).toBe(false);
	});
});

describe("assignResearch", () => {
	it("assigns research to an idle lab", () => {
		const state = withUnlockedLab("lab-1");
		const result = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		expect(result.labs["lab-1"].activeResearchId).toBe("more-iron-ore");
		expect(result.labs["lab-1"].researchStartedAt).toBeTypeOf("number");
	});

	it("returns same state if cannot assign", () => {
		const state = createInitialGameState();
		const result = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		expect(result).toBe(state);
	});
});

describe("unassignResearch", () => {
	it("clears active research from lab", () => {
		const state = withUnlockedLab("lab-1");
		const assigned = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		const result = unassignResearch({ state: assigned, labId: "lab-1" });
		expect(result.labs["lab-1"].activeResearchId).toBeNull();
		expect(result.labs["lab-1"].researchStartedAt).toBeNull();
	});

	it("returns same state if no active research", () => {
		const state = withUnlockedLab("lab-1");
		const result = unassignResearch({ state, labId: "lab-1" });
		expect(result).toBe(state);
	});
});

describe("advanceResearch", () => {
	it("does nothing when no labs are active", () => {
		const state = withUnlockedLab("lab-1");
		const result = advanceResearch({ state, now: Date.now() });
		expect(result).toBe(state);
	});

	it("does not advance if not enough time has passed", () => {
		const now = Date.now();
		const state = withUnlockedLab("lab-1");
		const assigned: GameState = {
			...state,
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - 5000, // 5 seconds, need 10
				},
			},
		};
		const result = advanceResearch({ state: assigned, now });
		expect(result).toBe(assigned);
		expect(result.research["more-iron-ore"]).toBe(0);
	});

	it("advances one level when enough time has passed", () => {
		const now = Date.now();
		const levelTime = getResearchTime(0); // 10 seconds
		const state = withUnlockedLab("lab-1");
		const assigned: GameState = {
			...state,
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - levelTime * 1000,
				},
			},
		};
		const result = advanceResearch({ state: assigned, now });
		expect(result.research["more-iron-ore"]).toBe(1);
		expect(result.labs["lab-1"].activeResearchId).toBe("more-iron-ore");
		expect(result.labs["lab-1"].researchStartedAt).not.toBeNull();
	});

	it("auto-advances multiple levels", () => {
		const now = Date.now();
		// Level 0→1 = 10s, level 1→2 = 20s → total 30s
		const totalTimeMs = (getResearchTime(0) + getResearchTime(1)) * 1000;
		const state = withUnlockedLab("lab-1");
		const assigned: GameState = {
			...state,
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - totalTimeMs,
				},
			},
		};
		const result = advanceResearch({ state: assigned, now });
		expect(result.research["more-iron-ore"]).toBe(2);
	});

	it("clears lab assignment when reaching max level", () => {
		const now = Date.now();
		// Research from level 9 to 10: getResearchTime(9) = 10 * 2^9 = 5120s
		const levelTime = getResearchTime(9);
		const state = withUnlockedLab("lab-1");
		const atLevel9: GameState = {
			...state,
			research: { ...state.research, "more-iron-ore": 9 },
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - levelTime * 1000,
				},
			},
		};
		const result = advanceResearch({ state: atLevel9, now });
		expect(result.research["more-iron-ore"]).toBe(10);
		expect(result.labs["lab-1"].activeResearchId).toBeNull();
		expect(result.labs["lab-1"].researchStartedAt).toBeNull();
	});

	it("handles both labs independently", () => {
		const now = Date.now();
		const levelTime0 = getResearchTime(0) * 1000; // 10s
		const state = withBothLabsUnlocked();
		const assigned: GameState = {
			...state,
			labs: {
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - levelTime0, // completes level 1
				},
				"lab-2": {
					isUnlocked: true,
					activeResearchId: "more-plates",
					researchStartedAt: now - 5000, // not enough time
				},
			},
		};
		const result = advanceResearch({ state: assigned, now });
		expect(result.research["more-iron-ore"]).toBe(1);
		expect(result.research["more-plates"]).toBe(0);
	});
});

describe("getAssignResearchError", () => {
	it("returns null for valid assignment", () => {
		const state = withUnlockedLab("lab-1");
		expect(
			getAssignResearchError({
				state,
				labId: "lab-1",
				researchId: "more-iron-ore",
			}),
		).toBeNull();
	});

	it("returns error for locked lab", () => {
		const state = createInitialGameState();
		expect(
			getAssignResearchError({
				state,
				labId: "lab-1",
				researchId: "more-iron-ore",
			}),
		).toBe("Lab is not unlocked");
	});

	it("returns error for busy lab", () => {
		const state = withUnlockedLab("lab-1");
		const assigned = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		expect(
			getAssignResearchError({
				state: assigned,
				labId: "lab-1",
				researchId: "more-plates",
			}),
		).toBe("Lab already has active research");
	});

	it("returns error for locked resource", () => {
		const state = withUnlockedLab("lab-1");
		expect(
			getAssignResearchError({
				state,
				labId: "lab-1",
				researchId: "more-plates",
			}),
		).toBe("Resource is not unlocked");
	});

	it("returns error for maxed research", () => {
		const state = withUnlockedLab("lab-1");
		const maxed: GameState = {
			...state,
			research: { ...state.research, "more-iron-ore": MAX_RESEARCH_LEVEL },
		};
		expect(
			getAssignResearchError({
				state: maxed,
				labId: "lab-1",
				researchId: "more-iron-ore",
			}),
		).toBe("Research is already at max level");
	});

	it("returns error for research assigned to another lab", () => {
		const state = withBothLabsUnlocked();
		const assigned = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		expect(
			getAssignResearchError({
				state: assigned,
				labId: "lab-2",
				researchId: "more-iron-ore",
			}),
		).toBe("Research is already assigned to another lab");
	});
});

describe("resetResearch", () => {
	it("returns same state when nothing to reset", () => {
		const state = createInitialGameState();
		const result = resetResearch({ state });
		expect(result).toBe(state);
	});

	it("resets research levels to 0", () => {
		const state = createInitialGameState();
		const withLevels: GameState = {
			...state,
			research: {
				...state.research,
				"more-iron-ore": 5,
				"more-plates": 3,
				"more-nuclear-pasta": 10,
			},
		};
		const result = resetResearch({ state: withLevels });
		for (const level of Object.values(result.research)) {
			expect(level).toBe(0);
		}
	});

	it("locks all labs and clears active research", () => {
		const state = withBothLabsUnlocked();
		const assigned = assignResearch({
			state,
			labId: "lab-1",
			researchId: "more-iron-ore",
		});
		const result = resetResearch({ state: assigned });
		for (const lab of Object.values(result.labs)) {
			expect(lab.isUnlocked).toBe(false);
			expect(lab.activeResearchId).toBeNull();
			expect(lab.researchStartedAt).toBeNull();
		}
	});

	it("preserves non-research state", () => {
		const state = withUnlockedLab("lab-1");
		const result = resetResearch({ state });
		expect(result.resources).toBe(state.resources);
		expect(result.shopBoosts).toBe(state.shopBoosts);
		expect(result.lastSavedAt).toBe(state.lastSavedAt);
	});

	it("resets when only labs are unlocked but research is 0", () => {
		const state = withUnlockedLab("lab-1");
		const result = resetResearch({ state });
		expect(result).not.toBe(state);
		expect(result.labs["lab-1"].isUnlocked).toBe(false);
	});
});

describe("advanceResearchWithReport", () => {
	it("returns empty levelUps when no labs are active", () => {
		const state = withUnlockedLab("lab-1");
		const result = advanceResearchWithReport({ state, now: Date.now() });
		expect(result.state).toBe(state);
		expect(result.levelUps).toEqual([]);
	});

	it("reports a single level-up", () => {
		const now = Date.now();
		const levelTime = getResearchTime(0) * 1000;
		const state = withUnlockedLab("lab-1");
		const assigned: GameState = {
			...state,
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - levelTime,
				},
			},
		};
		const result = advanceResearchWithReport({ state: assigned, now });
		expect(result.state.research["more-iron-ore"]).toBe(1);
		expect(result.levelUps).toEqual([
			{ researchId: "more-iron-ore", newLevel: 1 },
		]);
	});

	it("reports each intermediate level on a multi-level jump", () => {
		const now = Date.now();
		const totalTimeMs = (getResearchTime(0) + getResearchTime(1)) * 1000;
		const state = withUnlockedLab("lab-1");
		const assigned: GameState = {
			...state,
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - totalTimeMs,
				},
			},
		};
		const result = advanceResearchWithReport({ state: assigned, now });
		expect(result.state.research["more-iron-ore"]).toBe(2);
		expect(result.levelUps).toEqual([
			{ researchId: "more-iron-ore", newLevel: 1 },
			{ researchId: "more-iron-ore", newLevel: 2 },
		]);
	});

	it("reports level-ups from two labs simultaneously", () => {
		const now = Date.now();
		const levelTime = getResearchTime(0) * 1000;
		const state = withBothLabsUnlocked();
		const assigned: GameState = {
			...state,
			labs: {
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - levelTime,
				},
				"lab-2": {
					isUnlocked: true,
					activeResearchId: "more-plates",
					researchStartedAt: now - levelTime,
				},
			},
		};
		const result = advanceResearchWithReport({ state: assigned, now });
		expect(result.state.research["more-iron-ore"]).toBe(1);
		expect(result.state.research["more-plates"]).toBe(1);
		expect(result.levelUps).toEqual([
			{ researchId: "more-iron-ore", newLevel: 1 },
			{ researchId: "more-plates", newLevel: 1 },
		]);
	});

	it("reports level 10 when reaching max", () => {
		const now = Date.now();
		const levelTime = getResearchTime(9) * 1000;
		const state = withUnlockedLab("lab-1");
		const atLevel9: GameState = {
			...state,
			research: { ...state.research, "more-iron-ore": 9 },
			labs: {
				...state.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - levelTime,
				},
			},
		};
		const result = advanceResearchWithReport({ state: atLevel9, now });
		expect(result.levelUps).toEqual([
			{ researchId: "more-iron-ore", newLevel: 10 },
		]);
		expect(result.state.labs["lab-1"].activeResearchId).toBeNull();
	});
});

describe("getResearchTime", () => {
	it("returns 10 for level 0", () => {
		expect(getResearchTime(0)).toBe(10);
	});

	it("returns 20 for level 1", () => {
		expect(getResearchTime(1)).toBe(20);
	});

	it("returns 5120 for level 9", () => {
		expect(getResearchTime(9)).toBe(5120);
	});
});

describe("getResearchTimeMultiplier", () => {
	it("returns 1 when research-2x is inactive", () => {
		const state = createInitialGameState();
		expect(getResearchTimeMultiplier({ shopBoosts: state.shopBoosts })).toBe(1);
	});

	it("returns 0.5 when research-2x is active", () => {
		const state = createInitialGameState();
		const boosts = { ...state.shopBoosts, "research-2x": true };
		expect(getResearchTimeMultiplier({ shopBoosts: boosts })).toBe(0.5);
	});
});

describe("advanceResearch with research-2x boost", () => {
	it("advances one level in half the base time", () => {
		const now = Date.now();
		const halfLevelTime = (getResearchTime(0) * 1000) / 2; // 5s instead of 10s
		const state: GameState = {
			...withUnlockedLab("lab-1"),
			shopBoosts: {
				...createInitialGameState().shopBoosts,
				"research-2x": true,
			},
			labs: {
				...withUnlockedLab("lab-1").labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - halfLevelTime,
				},
			},
		};
		const result = advanceResearch({ state, now });
		expect(result.research["more-iron-ore"]).toBe(1);
	});

	it("does not advance at less than half the base time", () => {
		const now = Date.now();
		const state: GameState = {
			...withUnlockedLab("lab-1"),
			shopBoosts: {
				...createInitialGameState().shopBoosts,
				"research-2x": true,
			},
			labs: {
				...withUnlockedLab("lab-1").labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - 4000, // 4s, need 5s with boost
				},
			},
		};
		const result = advanceResearch({ state, now });
		expect(result.research["more-iron-ore"]).toBe(0);
	});

	it("auto-advances multiple levels with boost", () => {
		const now = Date.now();
		// With boost: level 0→1 = 5s, level 1→2 = 10s → total 15s
		const totalTimeMs =
			(getResearchTime(0) * 0.5 + getResearchTime(1) * 0.5) * 1000;
		const state: GameState = {
			...withUnlockedLab("lab-1"),
			shopBoosts: {
				...createInitialGameState().shopBoosts,
				"research-2x": true,
			},
			labs: {
				...withUnlockedLab("lab-1").labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore",
					researchStartedAt: now - totalTimeMs,
				},
			},
		};
		const result = advanceResearch({ state, now });
		expect(result.research["more-iron-ore"]).toBe(2);
	});
});

describe("getSpeedResearchMultiplier", () => {
	const research = createInitialGameState().research;

	it("level 0 → 1.0 (no effect)", () => {
		expect(
			getSpeedResearchMultiplier({ research, resourceId: "iron-ore" }),
		).toBe(1);
	});

	it("level 5 → 1/1.5 ≈ 0.667", () => {
		const r = { ...research, "speed-iron-ore": 5 };
		expect(
			getSpeedResearchMultiplier({ research: r, resourceId: "iron-ore" }),
		).toBeCloseTo(1 / 1.5);
	});

	it("level 10 → 0.5 (halved run time)", () => {
		const r = { ...research, "speed-iron-ore": 10 };
		expect(
			getSpeedResearchMultiplier({ research: r, resourceId: "iron-ore" }),
		).toBe(0.5);
	});
});

describe("speed research assignment", () => {
	it("can assign speed research to a lab", () => {
		const state = withUnlockedLab("lab-1");
		expect(
			canAssignResearch({
				state,
				labId: "lab-1",
				researchId: "speed-iron-ore",
			}),
		).toBe(true);
	});

	it("cannot assign speed research for locked resource", () => {
		const state = withUnlockedLab("lab-1");
		expect(
			getAssignResearchError({
				state,
				labId: "lab-1",
				researchId: "speed-plates",
			}),
		).toBe("Resource is not unlocked");
	});

	it("advances speed research like efficiency research", () => {
		const now = Date.now();
		const levelTimeMs = getResearchTime(0) * 1000; // 10s for level 0→1
		const state: GameState = {
			...withUnlockedLab("lab-1"),
			labs: {
				...withUnlockedLab("lab-1").labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "speed-iron-ore",
					researchStartedAt: now - levelTimeMs,
				},
			},
		};
		const result = advanceResearch({ state, now });
		expect(result.research["speed-iron-ore"]).toBe(1);
	});

	it("resetResearch resets speed research to 0", () => {
		const state: GameState = {
			...withUnlockedLab("lab-1"),
			research: {
				...createInitialGameState().research,
				"speed-iron-ore": 5,
				"more-iron-ore": 3,
			},
		};
		const result = resetResearch({ state });
		expect(result.research["speed-iron-ore"]).toBe(0);
		expect(result.research["more-iron-ore"]).toBe(0);
	});
});
