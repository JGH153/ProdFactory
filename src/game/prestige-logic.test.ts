import { describe, expect, it } from "vitest";
import { bigNum, bigNumZero } from "@/lib/big-number";
import { createInitialGameState } from "./initial-state";
import {
	canPrestige,
	computeCouponsEarned,
	performPrestige,
} from "./prestige-logic";
import { withNuclearPasta } from "./test-helpers";

describe("computeCouponsEarned", () => {
	it("0 Nuclear Pasta → 0 coupons", () => {
		const result = computeCouponsEarned({
			nuclearPastaProducedThisRun: bigNumZero,
		});
		expect(result).toEqual(bigNumZero);
	});

	it("1 Nuclear Pasta → 1 coupon (floor(sqrt(1)))", () => {
		const result = computeCouponsEarned({
			nuclearPastaProducedThisRun: bigNum(1),
		});
		expect(result).toEqual(bigNum(1));
	});

	it("4 Nuclear Pasta → 2 coupons (floor(sqrt(4)))", () => {
		const result = computeCouponsEarned({
			nuclearPastaProducedThisRun: bigNum(4),
		});
		expect(result).toEqual(bigNum(2));
	});

	it("10 Nuclear Pasta → 3 coupons (floor(sqrt(10)))", () => {
		const result = computeCouponsEarned({
			nuclearPastaProducedThisRun: bigNum(10),
		});
		expect(result).toEqual(bigNum(3));
	});

	it("100 Nuclear Pasta → 10 coupons", () => {
		const result = computeCouponsEarned({
			nuclearPastaProducedThisRun: bigNum(100),
		});
		expect(result).toEqual(bigNum(10));
	});
});

describe("canPrestige", () => {
	it("cannot prestige with zero Nuclear Pasta produced", () => {
		const state = createInitialGameState();
		expect(canPrestige({ state })).toBe(false);
	});

	it("can prestige with Nuclear Pasta produced", () => {
		const state = withNuclearPasta(5);
		expect(canPrestige({ state })).toBe(true);
	});
});

describe("performPrestige", () => {
	it("returns same state if cannot prestige", () => {
		const state = createInitialGameState();
		expect(performPrestige({ state })).toBe(state);
	});

	it("increments prestige count", () => {
		const state = withNuclearPasta(4);
		const result = performPrestige({ state });
		expect(result.prestige.prestigeCount).toBe(1);
	});

	it("awards coupons to balance and lifetime", () => {
		const state = withNuclearPasta(100);
		const result = performPrestige({ state });
		// sqrt(100) = 10
		expect(result.prestige.couponBalance).toEqual(bigNum(10));
		expect(result.prestige.lifetimeCoupons).toEqual(bigNum(10));
	});

	it("resets nuclearPastaProducedThisRun to zero", () => {
		const state = withNuclearPasta(50);
		const result = performPrestige({ state });
		expect(result.prestige.nuclearPastaProducedThisRun).toEqual(bigNumZero);
	});

	it("resets resources to initial state", () => {
		const state = withNuclearPasta(1);
		state.resources["iron-ore"].amount = bigNum(999);
		state.resources["iron-ore"].producers = 10;
		const result = performPrestige({ state });
		const fresh = createInitialGameState();
		expect(result.resources["iron-ore"].amount).toEqual(
			fresh.resources["iron-ore"].amount,
		);
		expect(result.resources["iron-ore"].producers).toBe(
			fresh.resources["iron-ore"].producers,
		);
	});

	it("preserves shop boosts", () => {
		const state = withNuclearPasta(1);
		state.shopBoosts["production-20x"] = true;
		const result = performPrestige({ state });
		expect(result.shopBoosts["production-20x"]).toBe(true);
	});

	it("preserves research levels", () => {
		const state = withNuclearPasta(1);
		state.research["more-iron-ore"] = 5;
		const result = performPrestige({ state });
		expect(result.research["more-iron-ore"]).toBe(5);
	});

	it("clears lab assignments but keeps unlock status", () => {
		const state = withNuclearPasta(1);
		state.labs["lab-1"].isUnlocked = true;
		state.labs["lab-1"].activeResearchId = "more-iron-ore";
		state.labs["lab-1"].researchStartedAt = Date.now();
		const result = performPrestige({ state });
		expect(result.labs["lab-1"].isUnlocked).toBe(true);
		expect(result.labs["lab-1"].activeResearchId).toBeNull();
		expect(result.labs["lab-1"].researchStartedAt).toBeNull();
	});

	it("milestone: 2 prestiges → start with 200 Iron Ore", () => {
		const state = withNuclearPasta(1);
		state.prestige.prestigeCount = 1; // will become 2 after prestige
		const result = performPrestige({ state });
		expect(result.resources["iron-ore"].amount).toEqual(bigNum(200));
	});

	it("milestone: 3 prestiges → Iron Ore automation free", () => {
		const state = withNuclearPasta(1);
		state.prestige.prestigeCount = 2;
		const result = performPrestige({ state });
		expect(result.resources["iron-ore"].isAutomated).toBe(true);
	});

	it("milestone: 5 prestiges → Plates unlocked with 1 producer", () => {
		const state = withNuclearPasta(1);
		state.prestige.prestigeCount = 4;
		const result = performPrestige({ state });
		expect(result.resources.plates.isUnlocked).toBe(true);
		expect(result.resources.plates.producers).toBe(1);
	});
});
