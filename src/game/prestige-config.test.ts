import { describe, expect, it } from "vitest";
import { type BigNum, bigNum, bigNumZero } from "@/lib/big-number";
import {
	COUPON_BONUS_PER_UNIT,
	getPrestigePassiveMultiplier,
	isMilestoneEarned,
} from "./prestige-config";

describe("getPrestigePassiveMultiplier", () => {
	it("returns 1 with zero lifetime coupons", () => {
		expect(getPrestigePassiveMultiplier({ lifetimeCoupons: bigNumZero })).toBe(
			1,
		);
	});

	it("returns 1.1 with 1 lifetime coupon", () => {
		expect(
			getPrestigePassiveMultiplier({ lifetimeCoupons: bigNum(1) }),
		).toBeCloseTo(1 + COUPON_BONUS_PER_UNIT);
	});

	it("returns 6 with 50 lifetime coupons", () => {
		expect(
			getPrestigePassiveMultiplier({ lifetimeCoupons: bigNum(50) }),
		).toBeCloseTo(6);
	});

	it("does not return Infinity for very large coupon counts", () => {
		// BigNum with exponent > 308 would cause bnToNumber to return Infinity
		// without the Math.min cap
		const hugeCoupons: BigNum = { mantissa: 1, exponent: 500 };
		const result = getPrestigePassiveMultiplier({
			lifetimeCoupons: hugeCoupons,
		});
		expect(Number.isFinite(result)).toBe(true);
		expect(result).toBeGreaterThan(1);
	});

	it("scales linearly with coupon count", () => {
		const mul10 = getPrestigePassiveMultiplier({
			lifetimeCoupons: bigNum(10),
		});
		const mul20 = getPrestigePassiveMultiplier({
			lifetimeCoupons: bigNum(20),
		});
		expect(mul20 - 1).toBeCloseTo((mul10 - 1) * 2);
	});
});

describe("isMilestoneEarned", () => {
	it("first-evaluation earned at prestige count 1", () => {
		expect(
			isMilestoneEarned({ milestoneId: "first-evaluation", prestigeCount: 1 }),
		).toBe(true);
	});

	it("first-evaluation not earned at prestige count 0", () => {
		expect(
			isMilestoneEarned({ milestoneId: "first-evaluation", prestigeCount: 0 }),
		).toBe(false);
	});

	it("returning-employee earned at prestige count 2", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "returning-employee",
				prestigeCount: 2,
			}),
		).toBe(true);
	});

	it("assembly-line earned at prestige count 4", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "assembly-line",
				prestigeCount: 4,
			}),
		).toBe(true);
	});

	it("assembly-line not earned at prestige count 3", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "assembly-line",
				prestigeCount: 3,
			}),
		).toBe(false);
	});

	it("experienced-builder not earned at prestige count 4", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "experienced-builder",
				prestigeCount: 4,
			}),
		).toBe(false);
	});

	it("experienced-builder earned at prestige count 5", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "experienced-builder",
				prestigeCount: 5,
			}),
		).toBe(true);
	});

	it("resource-manager earned at prestige count 6", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "resource-manager",
				prestigeCount: 6,
			}),
		).toBe(true);
	});

	it("efficiency-expert earned at prestige count 8", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "efficiency-expert",
				prestigeCount: 8,
			}),
		).toBe(true);
	});

	it("efficiency-expert not earned at prestige count 7", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "efficiency-expert",
				prestigeCount: 7,
			}),
		).toBe(false);
	});

	it("all milestones earned at high prestige count", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "first-evaluation",
				prestigeCount: 100,
			}),
		).toBe(true);
		expect(
			isMilestoneEarned({
				milestoneId: "experienced-builder",
				prestigeCount: 100,
			}),
		).toBe(true);
		expect(
			isMilestoneEarned({
				milestoneId: "factory-tycoon",
				prestigeCount: 100,
			}),
		).toBe(true);
	});

	it("factory-tycoon not earned at prestige count 19", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "factory-tycoon",
				prestigeCount: 19,
			}),
		).toBe(false);
	});

	it("factory-tycoon earned at prestige count 20", () => {
		expect(
			isMilestoneEarned({
				milestoneId: "factory-tycoon",
				prestigeCount: 20,
			}),
		).toBe(true);
	});
});
