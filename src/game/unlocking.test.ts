import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./initial-state";
import { withPlates } from "./test-helpers";
import { canUnlock, unlockResource } from "./unlocking";

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
