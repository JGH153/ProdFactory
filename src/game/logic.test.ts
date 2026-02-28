import { describe, expect, it } from "vitest";
import { bigNum, bigNumZero, bnFloor, bnMul, bnPow } from "@/lib/big-number";
import { createInitialGameState } from "./initial-state";
import {
	activateBoost,
	buyAutomation,
	buyMaxProducers,
	buyProducer,
	canBuyAutomation,
	canBuyProducer,
	canStartRun,
	canUnlock,
	completeRun,
	getClampedRunTime,
	getEffectiveRunTime,
	getMaxAffordableProducers,
	getProducerCost,
	getRunTimeMultiplier,
	isContinuousMode,
	isRunComplete,
	resetShopBoosts,
	startRun,
	togglePause,
	unlockResource,
} from "./logic";
import type { GameState } from "./types";

// Helper to build a state with overrides for a specific resource
const withIronOre = (
	overrides: Partial<GameState["resources"]["iron-ore"]>,
): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		resources: {
			...state.resources,
			"iron-ore": { ...state.resources["iron-ore"], ...overrides },
		},
	};
};

const withPlates = (
	ironOreAmount: number,
	platesOverrides?: Partial<GameState["resources"]["plates"]>,
): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		resources: {
			...state.resources,
			"iron-ore": {
				...state.resources["iron-ore"],
				amount: bigNum(ironOreAmount),
			},
			plates: { ...state.resources.plates, ...platesOverrides },
		},
	};
};

describe("getProducerCost", () => {
	it("iron-ore at owned=0: floor(2 * 1.15^0) = 2", () => {
		const cost = getProducerCost({ resourceId: "iron-ore", owned: 0 });
		expect(cost).toEqual(bigNum(2));
	});

	it("iron-ore at owned=1: floor(2 * 1.15^1) = floor(2.3) = 2", () => {
		const cost = getProducerCost({ resourceId: "iron-ore", owned: 1 });
		expect(cost).toEqual(bigNum(2));
	});

	it("iron-ore at owned=10: floor(2 * 1.15^10) = 8", () => {
		const expected = bnFloor(bnMul(bigNum(2), bnPow(bigNum(1.15), 10)));
		const cost = getProducerCost({ resourceId: "iron-ore", owned: 10 });
		expect(cost).toEqual(expected);
	});

	it("plates at owned=0: floor(4 * 1.15^0) = 4", () => {
		const cost = getProducerCost({ resourceId: "plates", owned: 0 });
		expect(cost).toEqual(bigNum(4));
	});
});

describe("canBuyProducer", () => {
	it("unlocked with sufficient amount → true", () => {
		// Initial state: iron-ore has producers=1, cost at owned=1 is floor(2*1.15)=2
		const state = withIronOre({ amount: bigNum(2) });
		expect(canBuyProducer({ state, resourceId: "iron-ore" })).toBe(true);
	});

	it("insufficient amount → false", () => {
		const state = withIronOre({ amount: bigNum(1) });
		expect(canBuyProducer({ state, resourceId: "iron-ore" })).toBe(false);
	});

	it("locked resource → false", () => {
		const state = createInitialGameState();
		expect(canBuyProducer({ state, resourceId: "plates" })).toBe(false);
	});
});

describe("buyProducer", () => {
	it("deducts cost and increments producers", () => {
		// iron-ore producers=1, cost=2, amount=10
		const state = withIronOre({ amount: bigNum(10) });
		const next = buyProducer({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].producers).toBe(2);
		// amount = 10 - 2 = 8
		const amount = next.resources["iron-ore"].amount;
		expect(amount.exponent).toBe(0);
		expect(amount.mantissa).toBeCloseTo(8, 10);
	});

	it("returns same state if cannot afford", () => {
		const state = withIronOre({ amount: bigNumZero });
		expect(buyProducer({ state, resourceId: "iron-ore" })).toBe(state);
	});

	it("returns a new object (immutable)", () => {
		const state = withIronOre({ amount: bigNum(10) });
		const next = buyProducer({ state, resourceId: "iron-ore" });
		expect(next).not.toBe(state);
	});
});

describe("getMaxAffordableProducers", () => {
	it("returns 0 for locked resource", () => {
		const state = createInitialGameState();
		expect(getMaxAffordableProducers({ state, resourceId: "plates" })).toBe(0);
	});

	it("returns 0 when amount is zero", () => {
		const state = createInitialGameState(); // iron-ore amount=0
		expect(getMaxAffordableProducers({ state, resourceId: "iron-ore" })).toBe(
			0,
		);
	});

	it("calculates correct count with amount=10, producers=0", () => {
		// With producers=0: costs are 2, 2, 2, 3, 3... sum(2+2+2+3)=9<=10, 9+3>10 → 4
		const state = withIronOre({ amount: bigNum(10), producers: 0 });
		expect(getMaxAffordableProducers({ state, resourceId: "iron-ore" })).toBe(
			4,
		);
	});
});

describe("buyMaxProducers", () => {
	it("buys all affordable producers", () => {
		const state = withIronOre({ amount: bigNum(10), producers: 0 });
		const next = buyMaxProducers({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].producers).toBe(4);
		// Should not be able to buy any more
		expect(canBuyProducer({ state: next, resourceId: "iron-ore" })).toBe(false);
	});
});

describe("getEffectiveRunTime", () => {
	it("producers=0: baseRunTime unchanged", () => {
		expect(getEffectiveRunTime({ resourceId: "iron-ore", producers: 0 })).toBe(
			1,
		);
	});

	it("producers=5: floor(5/10)=0 doublings, still 1s", () => {
		expect(getEffectiveRunTime({ resourceId: "iron-ore", producers: 5 })).toBe(
			1,
		);
	});

	it("producers=10: 1 doubling → 0.5s", () => {
		expect(getEffectiveRunTime({ resourceId: "iron-ore", producers: 10 })).toBe(
			0.5,
		);
	});

	it("producers=20: 2 doublings → 0.25s", () => {
		expect(getEffectiveRunTime({ resourceId: "iron-ore", producers: 20 })).toBe(
			0.25,
		);
	});

	it("plates baseRunTime=2: producers=0 → 2s", () => {
		expect(getEffectiveRunTime({ resourceId: "plates", producers: 0 })).toBe(2);
	});

	it("applies runTimeMultiplier", () => {
		expect(
			getEffectiveRunTime({
				resourceId: "iron-ore",
				producers: 0,
				runTimeMultiplier: 0.5,
			}),
		).toBe(0.5);
	});
});

describe("isContinuousMode", () => {
	it("producers=0: effective=1, not continuous", () => {
		expect(isContinuousMode({ resourceId: "iron-ore", producers: 0 })).toBe(
			false,
		);
	});

	it("producers=10: effective=0.5, exactly at threshold, NOT continuous (strict <)", () => {
		expect(isContinuousMode({ resourceId: "iron-ore", producers: 10 })).toBe(
			false,
		);
	});

	it("producers=20: effective=0.25 < 0.5, IS continuous", () => {
		expect(isContinuousMode({ resourceId: "iron-ore", producers: 20 })).toBe(
			true,
		);
	});

	it("runTimeMultiplier pushes below threshold", () => {
		// producers=0, baseRunTime=1, multiplier=0.4 → 0.4 < 0.5
		expect(
			isContinuousMode({
				resourceId: "iron-ore",
				producers: 0,
				runTimeMultiplier: 0.4,
			}),
		).toBe(true);
	});
});

describe("getClampedRunTime", () => {
	it("above threshold: returns effective time unchanged", () => {
		expect(getClampedRunTime({ resourceId: "iron-ore", producers: 0 })).toBe(1);
	});

	it("at threshold: returns 0.5", () => {
		expect(getClampedRunTime({ resourceId: "iron-ore", producers: 10 })).toBe(
			0.5,
		);
	});

	it("below threshold: clamps to 0.5", () => {
		expect(getClampedRunTime({ resourceId: "iron-ore", producers: 20 })).toBe(
			0.5,
		);
	});
});

describe("getRunTimeMultiplier", () => {
	const noBoosts = {
		"production-20x": false,
		"automation-2x": false,
		"runtime-50": false,
		"research-2x": false,
	};

	it("no active boosts → 1", () => {
		expect(
			getRunTimeMultiplier({ shopBoosts: noBoosts, isAutomated: false }),
		).toBe(1);
	});

	it("runtime-50 active → 0.5", () => {
		const boosts = { ...noBoosts, "runtime-50": true };
		expect(
			getRunTimeMultiplier({ shopBoosts: boosts, isAutomated: false }),
		).toBe(0.5);
	});

	it("automation-2x active + isAutomated=true → 0.5", () => {
		const boosts = { ...noBoosts, "automation-2x": true };
		expect(
			getRunTimeMultiplier({ shopBoosts: boosts, isAutomated: true }),
		).toBe(0.5);
	});

	it("automation-2x active + isAutomated=false → 1 (not applicable)", () => {
		const boosts = { ...noBoosts, "automation-2x": true };
		expect(
			getRunTimeMultiplier({ shopBoosts: boosts, isAutomated: false }),
		).toBe(1);
	});

	it("both runtime-50 and automation-2x + isAutomated=true → 0.25", () => {
		const boosts = { ...noBoosts, "runtime-50": true, "automation-2x": true };
		expect(
			getRunTimeMultiplier({ shopBoosts: boosts, isAutomated: true }),
		).toBe(0.25);
	});

	it("speedResearchMultiplier=0.5 → halves result", () => {
		expect(
			getRunTimeMultiplier({
				shopBoosts: noBoosts,
				isAutomated: false,
				speedResearchMultiplier: 0.5,
			}),
		).toBe(0.5);
	});

	it("speedResearchMultiplier stacks with runtime-50", () => {
		const boosts = { ...noBoosts, "runtime-50": true };
		expect(
			getRunTimeMultiplier({
				shopBoosts: boosts,
				isAutomated: false,
				speedResearchMultiplier: 0.5,
			}),
		).toBe(0.25);
	});

	it("speedResearchMultiplier stacks with all boosts", () => {
		const boosts = {
			...noBoosts,
			"runtime-50": true,
			"automation-2x": true,
		};
		expect(
			getRunTimeMultiplier({
				shopBoosts: boosts,
				isAutomated: true,
				speedResearchMultiplier: 0.5,
			}),
		).toBe(0.125);
	});
});

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

	it("production-20x boost multiplies output by 20", () => {
		const base = withIronOre({ producers: 1, runStartedAt: Date.now() - 5000 });
		const state = {
			...base,
			shopBoosts: { ...base.shopBoosts, "production-20x": true },
		};
		const next = completeRun({ state, resourceId: "iron-ore" });
		const amount = next.resources["iron-ore"].amount;
		expect(amount.mantissa).toBeCloseTo(2, 8); // 1 * 20 * 1 = 20 → {m:2, e:1}
		expect(amount.exponent).toBe(1);
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

describe("canUnlock", () => {
	it("enough iron-ore to unlock plates → true", () => {
		const state = withPlates(20);
		expect(canUnlock({ state, resourceId: "plates" })).toBe(true);
	});

	it("insufficient iron-ore → false", () => {
		const state = withPlates(19);
		expect(canUnlock({ state, resourceId: "plates" })).toBe(false);
	});

	it("already unlocked → false", () => {
		const state = withPlates(100, { isUnlocked: true });
		expect(canUnlock({ state, resourceId: "plates" })).toBe(false);
	});

	it("iron-ore (no unlock cost) → false", () => {
		const state = createInitialGameState();
		expect(canUnlock({ state, resourceId: "iron-ore" })).toBe(false);
	});
});

describe("unlockResource", () => {
	it("deducts unlock cost, sets isUnlocked=true, gives 1 free producer", () => {
		const state = withPlates(25);
		const next = unlockResource({ state, resourceId: "plates" });
		// Iron ore reduced by 20
		const ironOre = next.resources["iron-ore"].amount;
		expect(ironOre.mantissa).toBeCloseTo(5, 10);
		expect(ironOre.exponent).toBe(0);
		expect(next.resources.plates.isUnlocked).toBe(true);
		expect(next.resources.plates.producers).toBe(1);
	});

	it("cannot unlock → returns same state", () => {
		const state = createInitialGameState();
		expect(unlockResource({ state, resourceId: "plates" })).toBe(state);
	});
});

describe("canBuyAutomation", () => {
	it("unlocked, not automated, sufficient amount → true", () => {
		const state = withIronOre({ amount: bigNum(10) });
		expect(canBuyAutomation({ state, resourceId: "iron-ore" })).toBe(true);
	});

	it("already automated → false", () => {
		const state = withIronOre({ amount: bigNum(10), isAutomated: true });
		expect(canBuyAutomation({ state, resourceId: "iron-ore" })).toBe(false);
	});

	it("locked resource → false", () => {
		const state = createInitialGameState();
		expect(canBuyAutomation({ state, resourceId: "plates" })).toBe(false);
	});

	it("insufficient amount → false", () => {
		const state = withIronOre({ amount: bigNum(9) });
		expect(canBuyAutomation({ state, resourceId: "iron-ore" })).toBe(false);
	});
});

describe("buyAutomation", () => {
	it("deducts automationCost and sets isAutomated=true", () => {
		const state = withIronOre({ amount: bigNum(15) });
		const next = buyAutomation({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].isAutomated).toBe(true);
		// 15 - 10 = 5
		const amount = next.resources["iron-ore"].amount;
		expect(amount.mantissa).toBeCloseTo(5, 10);
		expect(amount.exponent).toBe(0);
	});

	it("cannot buy → returns same state", () => {
		const state = createInitialGameState();
		expect(buyAutomation({ state, resourceId: "iron-ore" })).toBe(state);
	});
});

describe("togglePause", () => {
	it("automated resource: isPaused=false → isPaused=true", () => {
		const state = withIronOre({ isAutomated: true, isPaused: false });
		const next = togglePause({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].isPaused).toBe(true);
	});

	it("automated resource: isPaused=true → isPaused=false", () => {
		const state = withIronOre({ isAutomated: true, isPaused: true });
		const next = togglePause({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].isPaused).toBe(false);
	});

	it("non-automated resource → returns same state", () => {
		const state = createInitialGameState(); // isAutomated=false
		expect(togglePause({ state, resourceId: "iron-ore" })).toBe(state);
	});
});

describe("activateBoost", () => {
	it("activates inactive boost", () => {
		const state = createInitialGameState();
		const next = activateBoost({ state, boostId: "production-20x" });
		expect(next.shopBoosts["production-20x"]).toBe(true);
	});

	it("already active boost → returns same state", () => {
		const state = createInitialGameState();
		const withBoost = activateBoost({ state, boostId: "production-20x" });
		expect(activateBoost({ state: withBoost, boostId: "production-20x" })).toBe(
			withBoost,
		);
	});

	it("activating one boost does not affect others", () => {
		const state = createInitialGameState();
		const next = activateBoost({ state, boostId: "runtime-50" });
		expect(next.shopBoosts["production-20x"]).toBe(false);
		expect(next.shopBoosts["automation-2x"]).toBe(false);
	});
});

describe("resetShopBoosts", () => {
	it("sets all boosts to false", () => {
		const state = createInitialGameState();
		const withBoosts = {
			...state,
			shopBoosts: {
				"production-20x": true,
				"automation-2x": true,
				"runtime-50": true,
				"research-2x": true,
			},
		};
		const next = resetShopBoosts({ state: withBoosts });
		expect(next.shopBoosts["production-20x"]).toBe(false);
		expect(next.shopBoosts["automation-2x"]).toBe(false);
		expect(next.shopBoosts["runtime-50"]).toBe(false);
		expect(next.shopBoosts["research-2x"]).toBe(false);
	});

	it("no active boosts → returns same state (short-circuit)", () => {
		const state = createInitialGameState();
		expect(resetShopBoosts({ state })).toBe(state);
	});
});
