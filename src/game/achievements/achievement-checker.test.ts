import { describe, expect, it } from "vitest";
import { bigNum } from "@/lib/big-number";
import { createInitialGameState } from "../initial-state";
import type { GameState } from "../types";
import { checkAchievements, evaluateCondition } from "./achievement-checker";
import { createInitialAchievementState } from "./achievement-types";

const baseState = (): GameState => createInitialGameState();

const withResource = (
	state: GameState,
	resourceId: string,
	overrides: Partial<GameState["resources"]["iron-ore"]>,
): GameState => ({
	...state,
	resources: {
		...state.resources,
		[resourceId]: {
			...state.resources[resourceId as keyof typeof state.resources],
			...overrides,
		},
	},
});

describe("evaluateCondition", () => {
	it("resource-produced: false when below threshold", () => {
		const state = withResource(baseState(), "iron-ore", {
			lifetimeProduced: bigNum(999_999),
		});
		expect(
			evaluateCondition({
				state,
				condition: {
					kind: "resource-produced",
					resourceId: "iron-ore",
					threshold: bigNum(1_000_000),
				},
			}),
		).toBe(false);
	});

	it("resource-produced: true when at threshold", () => {
		const state = withResource(baseState(), "iron-ore", {
			lifetimeProduced: bigNum(1_000_000),
		});
		expect(
			evaluateCondition({
				state,
				condition: {
					kind: "resource-produced",
					resourceId: "iron-ore",
					threshold: bigNum(1_000_000),
				},
			}),
		).toBe(true);
	});

	it("resource-unlocked: false when locked", () => {
		expect(
			evaluateCondition({
				state: baseState(),
				condition: { kind: "resource-unlocked", resourceId: "nuclear-pasta" },
			}),
		).toBe(false);
	});

	it("resource-unlocked: true when unlocked", () => {
		const state = withResource(baseState(), "nuclear-pasta", {
			isUnlocked: true,
		});
		expect(
			evaluateCondition({
				state,
				condition: { kind: "resource-unlocked", resourceId: "nuclear-pasta" },
			}),
		).toBe(true);
	});

	it("any-automated: true when at least 1 automated", () => {
		const state = withResource(baseState(), "iron-ore", {
			isAutomated: true,
		});
		expect(
			evaluateCondition({
				state,
				condition: { kind: "any-automated", count: 1 },
			}),
		).toBe(true);
	});

	it("any-automated: false when none automated", () => {
		expect(
			evaluateCondition({
				state: baseState(),
				condition: { kind: "any-automated", count: 1 },
			}),
		).toBe(false);
	});

	it("all-automated: false when not all automated", () => {
		const state = withResource(baseState(), "iron-ore", {
			isAutomated: true,
		});
		expect(
			evaluateCondition({
				state,
				condition: { kind: "all-automated" },
			}),
		).toBe(false);
	});

	it("all-automated: true when all resources are automated", () => {
		let state = baseState();
		for (const id of Object.keys(state.resources)) {
			state = withResource(state, id, {
				isUnlocked: true,
				isAutomated: true,
			});
		}
		expect(
			evaluateCondition({
				state,
				condition: { kind: "all-automated" },
			}),
		).toBe(true);
	});

	it("total-producers: true when sum meets threshold", () => {
		let state = baseState();
		// iron-ore starts with 1, add 49 more via plates
		state = withResource(state, "plates", { producers: 49 });
		expect(
			evaluateCondition({
				state,
				condition: { kind: "total-producers", threshold: 50 },
			}),
		).toBe(true);
	});

	it("total-producers: false when sum below threshold", () => {
		expect(
			evaluateCondition({
				state: baseState(),
				condition: { kind: "total-producers", threshold: 50 },
			}),
		).toBe(false);
	});

	it("max-research-any: true when any research is at max level", () => {
		const state = {
			...baseState(),
			research: { ...baseState().research, "more-iron-ore": 20 },
		};
		expect(
			evaluateCondition({
				state,
				condition: { kind: "max-research-any" },
			}),
		).toBe(true);
	});

	it("max-research-any: false when no research at max", () => {
		expect(
			evaluateCondition({
				state: baseState(),
				condition: { kind: "max-research-any" },
			}),
		).toBe(false);
	});

	it("all-efficiency-maxed: true when all efficiency research at 20", () => {
		const state = {
			...baseState(),
			research: {
				...baseState().research,
				"more-iron-ore": 20,
				"more-plates": 20,
				"more-reinforced-plate": 20,
				"more-modular-frame": 20,
				"more-heavy-modular-frame": 20,
				"more-fused-modular-frame": 20,
				"more-pressure-conversion-cube": 20,
				"more-nuclear-pasta": 20,
			},
		};
		expect(
			evaluateCondition({
				state,
				condition: { kind: "all-efficiency-maxed" },
			}),
		).toBe(true);
	});

	it("all-efficiency-maxed: false when one is missing", () => {
		const state = {
			...baseState(),
			research: {
				...baseState().research,
				"more-iron-ore": 20,
				"more-plates": 20,
				"more-reinforced-plate": 20,
				"more-modular-frame": 20,
				"more-heavy-modular-frame": 20,
				"more-fused-modular-frame": 20,
				"more-pressure-conversion-cube": 20,
				"more-nuclear-pasta": 19,
			},
		};
		expect(
			evaluateCondition({
				state,
				condition: { kind: "all-efficiency-maxed" },
			}),
		).toBe(false);
	});

	it("all-boosts-active: true when all 5 active", () => {
		const state = {
			...baseState(),
			shopBoosts: {
				"production-2x": true,
				"automation-2x": true,
				"runtime-50": true,
				"research-2x": true,
				"offline-2h": true,
			},
		};
		expect(
			evaluateCondition({
				state,
				condition: { kind: "all-boosts-active" },
			}),
		).toBe(true);
	});

	it("all-boosts-active: false when one is missing", () => {
		const state = {
			...baseState(),
			shopBoosts: {
				...baseState().shopBoosts,
				"production-2x": true,
			},
		};
		expect(
			evaluateCondition({
				state,
				condition: { kind: "all-boosts-active" },
			}),
		).toBe(false);
	});
});

describe("checkAchievements", () => {
	it("returns same reference when no new achievements", () => {
		const achievements = createInitialAchievementState();
		const { updated, newlyCompleted } = checkAchievements({
			state: baseState(),
			achievements,
		});
		expect(updated).toBe(achievements);
		expect(newlyCompleted).toHaveLength(0);
	});

	it("detects first-automation when iron-ore is automated", () => {
		const state = withResource(baseState(), "iron-ore", {
			isAutomated: true,
		});
		const achievements = createInitialAchievementState();
		const { updated, newlyCompleted } = checkAchievements({
			state,
			achievements,
		});
		expect(updated["first-automation"]).toBe(true);
		expect(newlyCompleted).toContain("first-automation");
	});

	it("skips already completed achievements", () => {
		const state = withResource(baseState(), "iron-ore", {
			isAutomated: true,
		});
		const achievements = {
			...createInitialAchievementState(),
			"first-automation": true,
		};
		const { updated, newlyCompleted } = checkAchievements({
			state,
			achievements,
		});
		expect(updated).toBe(achievements);
		expect(newlyCompleted).toHaveLength(0);
	});

	it("detects multiple achievements at once", () => {
		let state = baseState();
		state = withResource(state, "iron-ore", {
			isAutomated: true,
			lifetimeProduced: bigNum(1_000_000),
		});
		const achievements = createInitialAchievementState();
		const { newlyCompleted } = checkAchievements({
			state,
			achievements,
		});
		expect(newlyCompleted).toContain("first-automation");
		expect(newlyCompleted).toContain("iron-hoarder");
	});
});
