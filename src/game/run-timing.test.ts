import { describe, expect, it } from "vitest";
import {
	getClampedRunTime,
	getEffectiveRunTime,
	getRunTimeMultiplier,
	isContinuousMode,
} from "./run-timing";

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
		"production-2x": false,
		"automation-2x": false,
		"runtime-50": false,
		"research-2x": false,
		"offline-2h": false,
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
