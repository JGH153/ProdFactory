import { describe, expect, it } from "vitest";
import { RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import type { SerializedResourceState } from "@/game/serialization";
import { serializeGameState } from "@/game/serialization";
import type { ShopBoosts } from "@/game/types";
import { bigNum, bnDeserialize, bnSerialize } from "@/lib/big-number";
import type { SyncSnapshot } from "@/lib/redis";
import { buildSyncSnapshot, checkPlausibility } from "./plausibility";

const noBoosts: ShopBoosts = {
	"production-20x": false,
	"automation-2x": false,
	"runtime-50": false,
};

// Returns a SerializedGameState based on initial state with iron-ore field overrides
const makeClaimedState = (
	ironOreOverrides: Partial<SerializedResourceState> = {},
	boosts: ShopBoosts = noBoosts,
) => {
	const serialized = serializeGameState(createInitialGameState());
	return {
		...serialized,
		shopBoosts: boosts,
		resources: {
			...serialized.resources,
			"iron-ore": { ...serialized.resources["iron-ore"], ...ironOreOverrides },
		},
	};
};

// Returns a SyncSnapshot with iron-ore amount/producers overridden at the given timestamp
const makeSnapshot = (
	timestamp: number,
	ironOreAmountNum = 0,
	producers = 1,
): SyncSnapshot => {
	const base = serializeGameState(createInitialGameState());
	const stateWithOverrides = {
		...base,
		resources: {
			...base.resources,
			"iron-ore": {
				...base.resources["iron-ore"],
				amount: bnSerialize(bigNum(ironOreAmountNum)),
				producers,
			},
		},
	};
	return buildSyncSnapshot({ state: stateWithOverrides, timestamp });
};

describe("buildSyncSnapshot", () => {
	it("stores the timestamp", () => {
		const state = serializeGameState(createInitialGameState());
		const snapshot = buildSyncSnapshot({ state, timestamp: 12345 });
		expect(snapshot.timestamp).toBe(12345);
	});

	it("includes all resource IDs", () => {
		const state = serializeGameState(createInitialGameState());
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		for (const id of RESOURCE_ORDER) {
			expect(snapshot.resources[id]).toBeDefined();
		}
	});

	it("captures iron-ore amount from state", () => {
		const base = serializeGameState(createInitialGameState());
		const state = {
			...base,
			resources: {
				...base.resources,
				"iron-ore": {
					...base.resources["iron-ore"],
					amount: bnSerialize(bigNum(42)),
				},
			},
		};
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		const amount = bnDeserialize(snapshot.resources["iron-ore"].amount);
		expect(amount.mantissa).toBeCloseTo(4.2, 10);
		expect(amount.exponent).toBe(1);
	});

	it("captures producer count from state", () => {
		const base = serializeGameState(createInitialGameState());
		const state = {
			...base,
			resources: {
				...base.resources,
				"iron-ore": { ...base.resources["iron-ore"], producers: 5 },
			},
		};
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		expect(snapshot.resources["iron-ore"].producers).toBe(5);
	});
});

describe("checkPlausibility", () => {
	describe("early returns", () => {
		it("elapsed <= 0 returns no correction", () => {
			const t0 = 1000;
			const snapshot = makeSnapshot(t0);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(10)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0,
			});
			expect(result.corrected).toBe(false);
			expect(result.correctedState).toBeNull();
			expect(result.warnings).toHaveLength(0);
		});

		it("zero gain is skipped — no correction", () => {
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 10);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(10)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 5000,
			});
			expect(result.corrected).toBe(false);
		});

		it("resource decreased (spent) is always valid", () => {
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 100);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(50)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});
	});

	describe("locked and paused resources", () => {
		it("locked resource with gain is corrected to snapshot amount", () => {
			// snapshot=5, claimed=10 with isUnlocked=false → maxProduction=0 → reset to 5
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 5);
			const claimed = makeClaimedState({
				amount: bnSerialize(bigNum(10)),
				isUnlocked: false,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
			expect(result.warnings).toHaveLength(1);
			if (!result.correctedState) {
				throw new Error("Expected correctedState to be non-null");
			}
			const correctedAmount = bnDeserialize(
				result.correctedState.resources["iron-ore"].amount,
			);
			expect(correctedAmount.mantissa).toBeCloseTo(5, 10);
			expect(correctedAmount.exponent).toBe(0);
		});

		it("paused resource with gain is corrected to snapshot amount", () => {
			// snapshot=0, claimed=5 with isPaused=true → maxProduction=0 → reset to 0
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0);
			const claimed = makeClaimedState({
				amount: bnSerialize(bigNum(5)),
				isPaused: true,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
			if (!result.correctedState) {
				throw new Error("Expected correctedState to be non-null");
			}
			const correctedAmount = bnDeserialize(
				result.correctedState.resources["iron-ore"].amount,
			);
			expect(correctedAmount).toEqual({ mantissa: 0, exponent: 0 });
		});
	});

	describe("legitimate gains", () => {
		it("gain within tolerance is not corrected", () => {
			// 1 producer, elapsed=1000ms, runTime=1000ms
			// maxRuns=floor(1000/1000)+1=2, maxProd=2, tolerance=2.2
			// gain=2 → 2.2>=2 → no correction
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(2)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
			expect(result.correctedState).toBeNull();
		});

		it("gain sized to longer elapsed time is not corrected", () => {
			// elapsed=2000ms → maxRuns=floor(2000/1000)+1=3, maxProd=3, tolerance=3.3
			// gain=3 → 3.3>=3 → no correction
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(3)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 2000,
			});
			expect(result.corrected).toBe(false);
		});
	});

	describe("excessive gains", () => {
		it("gain exceeding tolerance is corrected", () => {
			// maxProd=2, tolerance=2.2, gain=100 → corrected
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(100)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
		});

		it("corrected amount equals snapshotAmount + maxProduction", () => {
			// snapshotAmount=0, maxProd=2 → correctedAmount=2
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(100)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			if (!result.correctedState) {
				throw new Error("Expected correctedState to be non-null");
			}
			const correctedAmount = bnDeserialize(
				result.correctedState.resources["iron-ore"].amount,
			);
			expect(correctedAmount.mantissa).toBeCloseTo(2, 10);
			expect(correctedAmount.exponent).toBe(0);
		});

		it("corrected state preserves other resource fields unchanged", () => {
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({
				amount: bnSerialize(bigNum(100)),
				producers: 1,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			if (!result.correctedState) {
				throw new Error("Expected correctedState to be non-null");
			}
			expect(result.correctedState.resources["iron-ore"].producers).toBe(1);
			expect(result.correctedState.resources["iron-ore"].isUnlocked).toBe(true);
		});

		it("warning message includes the resource name", () => {
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({ amount: bnSerialize(bigNum(100)) });
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("Iron Ore");
		});
	});

	describe("shop boosts", () => {
		it("production-20x: gain within boosted tolerance is not corrected", () => {
			// productionMul=20 → maxProd=2*1*20=40, tolerance=44
			// gain=40 → 44>=40 → no correction
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState(
				{ amount: bnSerialize(bigNum(40)) },
				{ "production-20x": true, "automation-2x": false, "runtime-50": false },
			);
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});

		it("production-20x: gain exceeding boosted tolerance is corrected", () => {
			// maxProd=40, tolerance=44, gain=1000 → corrected
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState(
				{ amount: bnSerialize(bigNum(1000)) },
				{ "production-20x": true, "automation-2x": false, "runtime-50": false },
			);
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
		});

		it("runtime-50: halved run time allows more runs to be claimed", () => {
			// RTM=0.5 → runTime=500ms, elapsed=1000ms → maxRuns=3, maxProd=3
			// gain=3 → tolerance=3.3 → no correction
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState(
				{ amount: bnSerialize(bigNum(3)) },
				{ "production-20x": false, "automation-2x": false, "runtime-50": true },
			);
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});

		it("automation-2x with automated resource halves run time", () => {
			// isAutomated=true + automation-2x → RTM=0.5 → runTime=500ms → maxRuns=3, maxProd=3
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState(
				{ amount: bnSerialize(bigNum(3)), isAutomated: true },
				{ "production-20x": false, "automation-2x": true, "runtime-50": false },
			);
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});
	});

	describe("speed milestones", () => {
		it("producers=10 halves run time, allowing higher production to be claimed", () => {
			// effectiveRunTime(iron-ore, producers=10)=0.5s → 500ms
			// maxRuns=floor(1000/500)+1=3, maxProd=3*10=30, tolerance=33
			// gain=30 → 33>=30 → no correction
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 10);
			const claimed = makeClaimedState({
				amount: bnSerialize(bigNum(30)),
				producers: 10,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});

		it("producers=10: gain exceeding milestone-adjusted tolerance is corrected", () => {
			// maxProd=30, tolerance=33, gain=1000 → corrected
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 10);
			const claimed = makeClaimedState({
				amount: bnSerialize(bigNum(1000)),
				producers: 10,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
		});
	});

	describe("producer count", () => {
		it("uses max of snapshot producers and claimed producers", () => {
			// snapshot=1 producer, claimed=2 producers → max=2
			// maxRuns=2, maxProd=2*2=4, tolerance=4.4
			// gain=4 → 4.4>=4 → no correction
			const t0 = 0;
			const snapshot = makeSnapshot(t0, 0, 1);
			const claimed = makeClaimedState({
				amount: bnSerialize(bigNum(4)),
				producers: 2,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});
	});
});
