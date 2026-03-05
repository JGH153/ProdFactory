import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./initial-state";
import { canStartRun, completeRun, isRunComplete, startRun } from "./runs";
import { withIronOre, withPlates } from "./test-helpers";

describe("canStartRun", () => {
	it("iron-ore unlocked, no active run → true", () => {
		const state = createInitialGameState();
		expect(canStartRun({ state, resourceId: "iron-ore" })).toBe(true);
	});

	it("run already in progress → false", () => {
		const state = withIronOre({ runStartedAt: Date.now() });
		expect(canStartRun({ state, resourceId: "iron-ore" })).toBe(false);
	});

	it("locked resource → false", () => {
		const state = createInitialGameState();
		expect(canStartRun({ state, resourceId: "plates" })).toBe(false);
	});

	it("plates with enough iron-ore → true", () => {
		// plates needs 4 iron-ore per run (1 producer, no continuous mode)
		const state = withPlates(4, { isUnlocked: true, producers: 1 });
		expect(canStartRun({ state, resourceId: "plates" })).toBe(true);
	});

	it("plates with insufficient iron-ore → false", () => {
		const state = withPlates(3, { isUnlocked: true, producers: 1 });
		expect(canStartRun({ state, resourceId: "plates" })).toBe(false);
	});
});

describe("startRun", () => {
	it("sets runStartedAt to a recent timestamp", () => {
		const before = Date.now();
		const state = createInitialGameState();
		const next = startRun({ state, resourceId: "iron-ore" });
		const after = Date.now();
		const ts = next.resources["iron-ore"].runStartedAt;
		expect(ts).not.toBeNull();
		expect(ts ?? -1).toBeGreaterThanOrEqual(before);
		expect(ts ?? -1).toBeLessThanOrEqual(after);
	});

	it("deducts input cost for plates run", () => {
		const state = withPlates(8, { isUnlocked: true, producers: 1 });
		const next = startRun({ state, resourceId: "plates" });
		// 8 iron-ore - (4 inputCostPerRun * 1 producer) = 4
		const ironOreAmount = next.resources["iron-ore"].amount;
		expect(ironOreAmount.mantissa).toBeCloseTo(4, 10);
		expect(ironOreAmount.exponent).toBe(0);
	});

	it("iron-ore (no input) does not change other resources", () => {
		const state = createInitialGameState();
		const next = startRun({ state, resourceId: "iron-ore" });
		// Only iron-ore should be modified
		expect(next.resources.plates).toBe(state.resources.plates);
	});

	it("cannot start → returns same state", () => {
		const state = withIronOre({ runStartedAt: Date.now() });
		expect(startRun({ state, resourceId: "iron-ore" })).toBe(state);
	});
});

describe("isRunComplete", () => {
	it("no active run → false", () => {
		const resource = createInitialGameState().resources["iron-ore"];
		expect(isRunComplete({ resource, runTime: 1 })).toBe(false);
	});

	it("run started in the distant past → true", () => {
		const resource = {
			...createInitialGameState().resources["iron-ore"],
			runStartedAt: Date.now() - 10000,
		};
		expect(isRunComplete({ resource, runTime: 1 })).toBe(true);
	});

	it("run just started → false for 100s run", () => {
		const resource = {
			...createInitialGameState().resources["iron-ore"],
			runStartedAt: Date.now(),
		};
		expect(isRunComplete({ resource, runTime: 100 })).toBe(false);
	});
});

describe("completeRun", () => {
	it("awards producers count as resources", () => {
		// iron-ore, producers=3, no boosts, no continuous mode
		const state = withIronOre({
			producers: 3,
			runStartedAt: Date.now() - 5000,
		});
		const next = completeRun({ state, resourceId: "iron-ore" });
		const amount = next.resources["iron-ore"].amount;
		expect(amount.mantissa).toBeCloseTo(3, 10);
		expect(amount.exponent).toBe(0);
		expect(next.resources["iron-ore"].runStartedAt).toBeNull();
	});

	it("production-2x boost multiplies output by 2", () => {
		const base = withIronOre({ producers: 1, runStartedAt: Date.now() - 5000 });
		const state = {
			...base,
			shopBoosts: { ...base.shopBoosts, "production-2x": true },
		};
		const next = completeRun({ state, resourceId: "iron-ore" });
		const amount = next.resources["iron-ore"].amount;
		expect(amount.mantissa).toBeCloseTo(2, 8); // 1 * 2 * 1 = 2 → {m:2, e:0}
		expect(amount.exponent).toBe(0);
	});

	it("continuous mode scales output by continuousMultiplier", () => {
		// producers=20 → effectiveRunTime=0.25, continuousMultiplier=0.5/0.25=2
		const state = withIronOre({
			producers: 20,
			runStartedAt: Date.now() - 5000,
		});
		const next = completeRun({ state, resourceId: "iron-ore" });
		const amount = next.resources["iron-ore"].amount;
		// produced = bigNum(20 * 1) * bigNum(2) = 40
		expect(amount.mantissa).toBeCloseTo(4, 8); // 40 → {m:4, e:1}
		expect(amount.exponent).toBe(1);
	});

	it("no active run → returns same state", () => {
		const state = createInitialGameState();
		expect(completeRun({ state, resourceId: "iron-ore" })).toBe(state);
	});
});
