import { describe, expect, it } from "vitest";
import { bigNum, bnToNumber } from "@/lib/big-number";
import { buyCouponUpgrade, canBuyCouponUpgrade } from "./coupon-shop";
import {
	COUPON_UPGRADE_ORDER,
	COUPON_UPGRADES,
	getEffectiveCostScaling,
	getSpeedSurgeMultiplier,
} from "./coupon-shop-config";
import { createInitialGameState } from "./initial-state";
import type { GameState } from "./types";

const withCoupons = (amount: number): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		prestige: {
			...state.prestige,
			couponBalance: bigNum(amount),
		},
	};
};

describe("canBuyCouponUpgrade", () => {
	it("returns false when coupon balance is insufficient", () => {
		const state = withCoupons(0);
		expect(canBuyCouponUpgrade({ state, upgradeId: "producer-discount" })).toBe(
			false,
		);
	});

	it("returns true when coupon balance is sufficient", () => {
		const state = withCoupons(2);
		expect(canBuyCouponUpgrade({ state, upgradeId: "producer-discount" })).toBe(
			true,
		);
	});

	it("returns false when upgrade is at max level", () => {
		const state = withCoupons(100);
		state.couponUpgrades["producer-discount"] =
			COUPON_UPGRADES["producer-discount"].maxLevel;
		expect(canBuyCouponUpgrade({ state, upgradeId: "producer-discount" })).toBe(
			false,
		);
	});
});

describe("buyCouponUpgrade", () => {
	it("increments upgrade level and deducts coupons", () => {
		const state = withCoupons(10);
		const result = buyCouponUpgrade({ state, upgradeId: "producer-discount" });
		expect(result.couponUpgrades["producer-discount"]).toBe(1);
		expect(bnToNumber(result.prestige.couponBalance)).toBe(8);
	});

	it("returns same state when cannot afford", () => {
		const state = withCoupons(0);
		const result = buyCouponUpgrade({ state, upgradeId: "producer-discount" });
		expect(result).toBe(state);
	});

	it("returns same state when at max level", () => {
		const state = withCoupons(100);
		state.couponUpgrades["speed-surge"] =
			COUPON_UPGRADES["speed-surge"].maxLevel;
		const result = buyCouponUpgrade({ state, upgradeId: "speed-surge" });
		expect(result).toBe(state);
	});

	it("can buy multiple levels sequentially", () => {
		let state = withCoupons(20);
		state = buyCouponUpgrade({ state, upgradeId: "offline-capacity" });
		state = buyCouponUpgrade({ state, upgradeId: "offline-capacity" });
		expect(state.couponUpgrades["offline-capacity"]).toBe(2);
		expect(bnToNumber(state.prestige.couponBalance)).toBe(16);
	});
});

describe("getEffectiveCostScaling", () => {
	it("returns base scaling at level 0", () => {
		expect(getEffectiveCostScaling({ level: 0 })).toBeCloseTo(1.15);
	});

	it("reduces scaling by 0.005 per level", () => {
		expect(getEffectiveCostScaling({ level: 5 })).toBeCloseTo(1.125);
	});

	it("reaches minimum at max level", () => {
		expect(getEffectiveCostScaling({ level: 10 })).toBeCloseTo(1.1);
	});
});

describe("getSpeedSurgeMultiplier", () => {
	it("returns 1 at level 0", () => {
		expect(getSpeedSurgeMultiplier({ level: 0 })).toBe(1);
	});

	it("returns 0.9 at level 1", () => {
		expect(getSpeedSurgeMultiplier({ level: 1 })).toBeCloseTo(0.9);
	});

	it("returns 0.9^3 at level 3", () => {
		expect(getSpeedSurgeMultiplier({ level: 3 })).toBeCloseTo(0.729);
	});
});

describe("coupon upgrade config", () => {
	it("all upgrades have positive cost and max level", () => {
		for (const id of COUPON_UPGRADE_ORDER) {
			const upgrade = COUPON_UPGRADES[id];
			expect(upgrade.costPerLevel).toBeGreaterThan(0);
			expect(upgrade.maxLevel).toBeGreaterThan(0);
		}
	});

	it("includes music unlock upgrades", () => {
		expect(COUPON_UPGRADE_ORDER).toContain("music-gemini");
		expect(COUPON_UPGRADE_ORDER).toContain("music-gemini-calm");
		expect(COUPON_UPGRADE_ORDER).toContain("music-classic");
	});

	it("music upgrades have maxLevel 1", () => {
		expect(COUPON_UPGRADES["music-gemini"].maxLevel).toBe(1);
		expect(COUPON_UPGRADES["music-gemini-calm"].maxLevel).toBe(1);
		expect(COUPON_UPGRADES["music-classic"].maxLevel).toBe(1);
	});
});

describe("buyCouponUpgrade — music unlock", () => {
	it("unlocks a music track in one purchase", () => {
		const state = withCoupons(10);
		const result = buyCouponUpgrade({ state, upgradeId: "music-gemini" });
		expect(result.couponUpgrades["music-gemini"]).toBe(1);
		expect(bnToNumber(result.prestige.couponBalance)).toBe(8);
	});

	it("cannot buy music upgrade beyond max level", () => {
		const state = withCoupons(10);
		state.couponUpgrades["music-gemini"] = 1;
		const result = buyCouponUpgrade({ state, upgradeId: "music-gemini" });
		expect(result).toBe(state);
	});
});
