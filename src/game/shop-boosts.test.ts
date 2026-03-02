import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./initial-state";
import { activateBoost, resetShopBoosts } from "./shop-boosts";

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
