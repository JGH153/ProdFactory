import { describe, expect, it } from "vitest";
import { bigNum } from "@/lib/big-number";
import { buyAutomation, canBuyAutomation, togglePause } from "./automation";
import { createInitialGameState } from "./initial-state";
import { withIronOre } from "./test-helpers";

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
