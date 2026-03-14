import { describe, expect, it } from "vitest";
import {
	getAchievementMultiplier,
	getCompletedCount,
	getTotalRewardPercent,
} from "./achievement-multiplier";
import { createInitialAchievementState } from "./achievement-types";

describe("getAchievementMultiplier", () => {
	it("returns 1 when no achievements completed", () => {
		const achievements = createInitialAchievementState();
		expect(getAchievementMultiplier({ achievements })).toBe(1);
	});

	it("returns 1.03 for first-automation alone (3%)", () => {
		const achievements = {
			...createInitialAchievementState(),
			"first-automation": true,
		};
		expect(getAchievementMultiplier({ achievements })).toBeCloseTo(1.03);
	});

	it("returns 1.69 when all achievements completed (69%)", () => {
		const achievements = {
			"iron-hoarder": true,
			"plate-empire": true,
			"full-chain": true,
			"first-automation": true,
			"full-automation": true,
			"speed-demon": true,
			"producer-army-50": true,
			"producer-army-200": true,
			"research-novice": true,
			"research-master": true,
			"shop-spree": true,
			"nuclear-stockpile": true,
		} as const;
		expect(getAchievementMultiplier({ achievements })).toBeCloseTo(1.69);
	});

	it("accumulates multiple rewards correctly", () => {
		const achievements = {
			...createInitialAchievementState(),
			"iron-hoarder": true, // 5%
			"plate-empire": true, // 5%
			"first-automation": true, // 3%
		};
		expect(getAchievementMultiplier({ achievements })).toBeCloseTo(1.13);
	});
});

describe("getCompletedCount", () => {
	it("returns 0 when none completed", () => {
		expect(
			getCompletedCount({ achievements: createInitialAchievementState() }),
		).toBe(0);
	});

	it("counts completed achievements", () => {
		const achievements = {
			...createInitialAchievementState(),
			"iron-hoarder": true,
			"full-chain": true,
		};
		expect(getCompletedCount({ achievements })).toBe(2);
	});
});

describe("getTotalRewardPercent", () => {
	it("returns 0 when none completed", () => {
		expect(
			getTotalRewardPercent({
				achievements: createInitialAchievementState(),
			}),
		).toBe(0);
	});

	it("sums reward percentages", () => {
		const achievements = {
			...createInitialAchievementState(),
			"iron-hoarder": true, // 5%
			"full-automation": true, // 10%
		};
		expect(getTotalRewardPercent({ achievements })).toBe(15);
	});
});
