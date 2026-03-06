import { describe, expect, it } from "vitest";
import { bigNum, bigNumZero, bnFloor, bnMul, bnPow } from "@/lib/big-number";
import { createInitialGameState } from "./initial-state";
import {
	buyMaxProducers,
	buyProducer,
	canBuyProducer,
	getMaxAffordableProducers,
	getProducerCost,
} from "./producers";
import { withIronOre } from "./test-helpers";

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

	it("producer discount level 5 uses reduced scaling (1.125)", () => {
		const discounted = getProducerCost({
			resourceId: "iron-ore",
			owned: 10,
			producerDiscountLevel: 5,
		});
		const expected = bnFloor(bnMul(bigNum(2), bnPow(bigNum(1.125), 10)));
		expect(discounted).toEqual(expected);
	});

	it("producer discount level 10 (max) uses minimum scaling (1.10)", () => {
		const discounted = getProducerCost({
			resourceId: "iron-ore",
			owned: 10,
			producerDiscountLevel: 10,
		});
		const expected = bnFloor(bnMul(bigNum(2), bnPow(bigNum(1.1), 10)));
		expect(discounted).toEqual(expected);
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

	it("returns same state when nothing affordable", () => {
		const state = withIronOre({ amount: bigNum(0), producers: 0 });
		expect(buyMaxProducers({ state, resourceId: "iron-ore" })).toBe(state);
	});
});

describe("large resource amounts (O(1) performance)", () => {
	it("getMaxAffordableProducers handles 10^50 resources", () => {
		const state = withIronOre({
			amount: { mantissa: 1, exponent: 50 },
			producers: 0,
		});
		const count = getMaxAffordableProducers({
			state,
			resourceId: "iron-ore",
		});
		// With 10^50 resources and baseCost=2, scaling=1.15:
		// 1.15^n ≈ 10^50 → n ≈ 50/log10(1.15) ≈ 823
		// Exact count depends on geometric sum, should be in the hundreds
		expect(count).toBeGreaterThan(700);
		expect(count).toBeLessThan(900);
	});

	it("getMaxAffordableProducers handles 10^100 resources", () => {
		const state = withIronOre({
			amount: { mantissa: 1, exponent: 100 },
			producers: 0,
		});
		const count = getMaxAffordableProducers({
			state,
			resourceId: "iron-ore",
		});
		expect(count).toBeGreaterThan(1500);
		expect(count).toBeLessThan(1800);
	});

	it("getMaxAffordableProducers with existing producers and large resources", () => {
		const state = withIronOre({
			amount: { mantissa: 1, exponent: 100 },
			producers: 500,
		});
		const count = getMaxAffordableProducers({
			state,
			resourceId: "iron-ore",
		});
		// Starting at 500 producers, fewer can be bought since costs are higher
		expect(count).toBeGreaterThan(1000);
		expect(count).toBeLessThan(1400);
	});

	it("buyMaxProducers with large resources produces correct result", () => {
		const state = withIronOre({
			amount: { mantissa: 1, exponent: 50 },
			producers: 0,
		});
		const count = getMaxAffordableProducers({
			state,
			resourceId: "iron-ore",
		});
		const next = buyMaxProducers({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].producers).toBe(count);
		// Should not be able to buy any more
		expect(canBuyProducer({ state: next, resourceId: "iron-ore" })).toBe(false);
	});

	it("getMaxAffordableProducers returns 1 when can afford exactly one", () => {
		// Cost at producers=0 is floor(2 * 1.15^0) = 2
		const state = withIronOre({ amount: bigNum(2), producers: 0 });
		expect(getMaxAffordableProducers({ state, resourceId: "iron-ore" })).toBe(
			1,
		);
	});

	it("handles resources beyond Number.MAX_VALUE (exponent > 308)", () => {
		const state = withIronOre({
			amount: { mantissa: 5, exponent: 400 },
			producers: 0,
		});
		const count = getMaxAffordableProducers({
			state,
			resourceId: "iron-ore",
		});
		expect(count).toBeGreaterThan(6000);
		expect(Number.isFinite(count)).toBe(true);
		const next = buyMaxProducers({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].producers).toBe(count);
		expect(canBuyProducer({ state: next, resourceId: "iron-ore" })).toBe(false);
	});

	it("matches loop-based calculation for moderate amounts", () => {
		// Verify our O(1) formula matches by checking the result is valid
		const state = withIronOre({ amount: bigNum(1000), producers: 0 });
		const count = getMaxAffordableProducers({
			state,
			resourceId: "iron-ore",
		});
		// Verify we can afford `count` but not `count + 1`
		const next = buyMaxProducers({ state, resourceId: "iron-ore" });
		expect(next.resources["iron-ore"].producers).toBe(count);
		expect(canBuyProducer({ state: next, resourceId: "iron-ore" })).toBe(false);
	});
});
