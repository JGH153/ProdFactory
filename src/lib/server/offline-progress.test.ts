import { describe, expect, it } from "vitest";
import { createInitialGameState } from "@/game/initial-state";
import type { SerializedResourceState } from "@/game/state/serialization";
import { serializeGameState } from "@/game/state/serialization";
import type { ResourceId, ShopBoosts } from "@/game/types";
import type { BigNum } from "@/lib/big-number";
import { bigNum, bnDeserialize, bnSerialize } from "@/lib/big-number";
import { computeOfflineProgress } from "./offline-progress";

const noBoosts: ShopBoosts = {
	"production-20x": false,
	"automation-2x": false,
	"runtime-50": false,
	"research-2x": false,
};

const makeState = (
	resourceOverrides: Partial<
		Record<ResourceId, Partial<SerializedResourceState>>
	> = {},
	opts: { lastSavedAt?: number; shopBoosts?: ShopBoosts } = {},
) => {
	const serialized = serializeGameState(createInitialGameState());
	const resources = { ...serialized.resources };
	for (const [id, overrides] of Object.entries(resourceOverrides)) {
		const rid = id as ResourceId;
		resources[rid] = { ...resources[rid], ...overrides };
	}
	return {
		...serialized,
		resources,
		lastSavedAt: opts.lastSavedAt ?? 100_000,
		shopBoosts: opts.shopBoosts ?? noBoosts,
	};
};

/** Extract the deserialized gain for a resource from the summary, or undefined. */
const gainFor = (
	summary: ReturnType<typeof computeOfflineProgress>["summary"],
	resourceId: ResourceId,
): BigNum | undefined => {
	if (!summary) {
		return undefined;
	}
	const entry = summary.gains.find((g) => g.resourceId === resourceId);
	return entry ? bnDeserialize(entry.amount) : undefined;
};

describe("computeOfflineProgress", () => {
	describe("early returns", () => {
		it("returns null summary when lastSavedAt is 0 (falsy)", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 0 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 200_000,
			});
			expect(result.summary).toBeNull();
			expect(result.updatedState).toBe(state);
		});

		it("returns null summary when elapsed < 10 seconds", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 9_000, // 9 seconds
			});
			expect(result.summary).toBeNull();
			expect(result.updatedState).toBe(state);
		});

		it("returns null summary when no resources are automated", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: false, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 60_000, // 60 seconds
			});
			expect(result.summary).toBeNull();
			expect(result.updatedState).toBe(state);
		});
	});

	describe("time capping", () => {
		it("elapsed exactly 8 hours: wasCapped is false", () => {
			const eightHoursMs = 8 * 3600 * 1000;
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + eightHoursMs,
			});
			expect(result.summary).not.toBeNull();
			expect(result.summary?.wasCapped).toBe(false);
			expect(result.summary?.elapsedSeconds).toBe(28_800);
		});

		it("elapsed > 8 hours: wasCapped is true and elapsedSeconds is capped", () => {
			const tenHoursMs = 10 * 3600 * 1000;
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + tenHoursMs,
			});
			expect(result.summary).not.toBeNull();
			expect(result.summary?.wasCapped).toBe(true);
			expect(result.summary?.elapsedSeconds).toBe(28_800);
		});

		it("elapsed exactly 10 seconds produces a summary (minimum boundary)", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 10_000,
			});
			expect(result.summary).not.toBeNull();
			expect(result.summary?.elapsedSeconds).toBe(10);
		});
	});

	describe("single resource (iron-ore, no input dependency)", () => {
		it("1 producer, 100s elapsed: gain = 100", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000, // 100 seconds
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// iron-ore baseRunTime=1s, 1 producer, no boosts
			// maxRuns = floor(100/1) = 100, gain = 100 * 1 * 1 = 100
			expect(gain?.mantissa).toBeCloseTo(1, 10);
			expect(gain?.exponent).toBe(2);
		});

		it("5 producers, 100s elapsed: gain = 500", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 5 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// maxRuns = 100, gain = 100 * 5 = 500
			expect(gain?.mantissa).toBeCloseTo(5, 10);
			expect(gain?.exponent).toBe(2);
		});

		it("locked resource is skipped", () => {
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: true,
						isUnlocked: false,
						producers: 1,
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			expect(result.summary).toBeNull();
		});

		it("paused resource is skipped", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, isPaused: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			expect(result.summary).toBeNull();
		});

		it("not automated resource is skipped", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: false, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			expect(result.summary).toBeNull();
		});
	});

	describe("production boosts", () => {
		it("production-20x multiplies gain by 20", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{
					lastSavedAt: 100_000,
					shopBoosts: {
						"production-20x": true,
						"automation-2x": false,
						"runtime-50": false,
						"research-2x": false,
					},
				},
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// maxRuns=100, gain = 100 * 1 * 20 = 2000
			expect(gain?.mantissa).toBeCloseTo(2, 10);
			expect(gain?.exponent).toBe(3);
		});

		it("runtime-50 halves run time, doubling runs", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{
					lastSavedAt: 100_000,
					shopBoosts: {
						"production-20x": false,
						"automation-2x": false,
						"runtime-50": true,
						"research-2x": false,
					},
				},
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// RTM=0.5, runTime=0.5s, maxRuns=floor(100/0.5)=200, gain=200
			expect(gain?.mantissa).toBeCloseTo(2, 10);
			expect(gain?.exponent).toBe(2);
		});

		it("automation-2x halves run time for automated resources", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{
					lastSavedAt: 100_000,
					shopBoosts: {
						"production-20x": false,
						"automation-2x": true,
						"runtime-50": false,
						"research-2x": false,
					},
				},
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// RTM=0.5 (automated + automation-2x), runTime=0.5s, maxRuns=200, gain=200
			expect(gain?.mantissa).toBeCloseTo(2, 10);
			expect(gain?.exponent).toBe(2);
		});
	});

	describe("speed milestones", () => {
		it("10 producers halves effective run time", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 10 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// effectiveRunTime = 1 / 2^(10/10) = 0.5s
			// maxRuns = floor(100/0.5) = 200
			// gain = 200 * 10 = 2000
			expect(gain?.mantissa).toBeCloseTo(2, 10);
			expect(gain?.exponent).toBe(3);
		});

		it("20 producers quarters effective run time", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 20 } },
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "iron-ore");
			expect(gain).toBeDefined();
			// effectiveRunTime = 1 / 2^2 = 0.25s
			// maxRuns = floor(100/0.25) = 400
			// gain = 400 * 20 = 8000
			expect(gain?.mantissa).toBeCloseTo(8, 10);
			expect(gain?.exponent).toBe(3);
		});
	});

	describe("input-bound production", () => {
		it("plates produce at full rate when iron-ore supply is sufficient", () => {
			// Give iron-ore lots of saved amount so plates are time-bound, not input-bound
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(100_000)),
					},
					plates: {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000, // 100 seconds
			});
			const gain = gainFor(result.summary, "plates");
			expect(gain).toBeDefined();
			// plates baseRunTime=2s, maxRuns=floor(100/2)=50, gain=50*1=50
			expect(gain?.mantissa).toBeCloseTo(5, 10);
			expect(gain?.exponent).toBe(1);
		});

		it("plates production is limited by available iron-ore input", () => {
			// Iron-ore not automated, small saved amount — plates are input-bound
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: false,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(20)), // only 20 iron-ore available
					},
					plates: {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "plates");
			expect(gain).toBeDefined();
			// plates inputCostPerRun=4, available=20, actualRuns=floor(20/4)=5
			// gain = 5 * 1 = 5
			expect(gain?.mantissa).toBeCloseTo(5, 10);
			expect(gain?.exponent).toBe(0);
		});

		it("plates gain is zero when no iron-ore is available", () => {
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: false,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
					plates: {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			const gain = gainFor(result.summary, "plates");
			// No iron-ore available → actualRuns=0 → skipped
			expect(gain).toBeUndefined();
		});
	});

	describe("chained tiers", () => {
		it("iron-ore offline gains feed into plates input budget", () => {
			// Both automated, iron-ore starts at 0 but produces during offline
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
					plates: {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000, // 100 seconds
			});

			// Iron-ore: maxRuns=100, gain=100
			const ironGain = gainFor(result.summary, "iron-ore");
			expect(ironGain).toBeDefined();
			expect(ironGain?.mantissa).toBeCloseTo(1, 10);
			expect(ironGain?.exponent).toBe(2);

			// Plates: netAvailable for iron-ore = 0 + 100 = 100
			// plates maxRunsByTime = floor(100/2) = 50
			// inputNeeded = 4 * 50 = 200, available = 100 → input-bound
			// actualRuns = floor(100/4) = 25, gain = 25
			const platesGain = gainFor(result.summary, "plates");
			expect(platesGain).toBeDefined();
			expect(platesGain?.mantissa).toBeCloseTo(2.5, 10);
			expect(platesGain?.exponent).toBe(1);
		});

		it("three-tier chain: iron-ore → plates → reinforced-plate", () => {
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
					plates: {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
					"reinforced-plate": {
						isAutomated: true,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(0)),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});

			// Iron-ore: gain=100
			const ironGain = gainFor(result.summary, "iron-ore");
			expect(ironGain).toBeDefined();
			expect(ironGain?.mantissa).toBeCloseTo(1, 10);
			expect(ironGain?.exponent).toBe(2);

			// Plates: netAvailable(iron-ore)=100, maxRunsByTime=50, inputNeeded=200 > 100
			// actualRuns=floor(100/4)=25, gain=25
			const platesGain = gainFor(result.summary, "plates");
			expect(platesGain).toBeDefined();
			expect(platesGain?.mantissa).toBeCloseTo(2.5, 10);
			expect(platesGain?.exponent).toBe(1);

			// Reinforced-plate: netAvailable(plates)=0+25=25, maxRunsByTime=floor(100/4)=25
			// inputNeeded=4*25=100 > 25 → actualRuns=floor(25/4)=6, gain=6
			const rpGain = gainFor(result.summary, "reinforced-plate");
			expect(rpGain).toBeDefined();
			expect(rpGain?.mantissa).toBeCloseTo(6, 10);
			expect(rpGain?.exponent).toBe(0);
		});
	});

	describe("state mutation correctness", () => {
		it("updatedState resource amount equals savedAmount + gain", () => {
			const savedAmount = bigNum(50);
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: true,
						producers: 1,
						amount: bnSerialize(savedAmount),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			// gain = 100, savedAmount = 50, total = 150
			const updatedAmount = bnDeserialize(
				result.updatedState.resources["iron-ore"].amount,
			);
			expect(updatedAmount.mantissa).toBeCloseTo(1.5, 10);
			expect(updatedAmount.exponent).toBe(2);
		});

		it("resources with no gain keep their original amount", () => {
			const state = makeState(
				{
					"iron-ore": {
						isAutomated: true,
						producers: 1,
					},
					plates: {
						isAutomated: false,
						isUnlocked: true,
						producers: 1,
						amount: bnSerialize(bigNum(42)),
					},
				},
				{ lastSavedAt: 100_000 },
			);
			const result = computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			// plates not automated → no gain → amount unchanged
			const platesAmount = bnDeserialize(
				result.updatedState.resources.plates.amount,
			);
			expect(platesAmount.mantissa).toBeCloseTo(4.2, 10);
			expect(platesAmount.exponent).toBe(1);
		});

		it("original state object is not mutated", () => {
			const state = makeState(
				{ "iron-ore": { isAutomated: true, producers: 1 } },
				{ lastSavedAt: 100_000 },
			);
			const originalAmount = state.resources["iron-ore"].amount;
			computeOfflineProgress({
				state,
				serverNow: 100_000 + 100_000,
			});
			// Original state's resource amount should be unchanged
			expect(state.resources["iron-ore"].amount).toBe(originalAmount);
		});
	});
});
