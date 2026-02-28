import { describe, expect, it } from "vitest";
import { RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { LAB_ORDER, RESEARCH_ORDER } from "@/game/research-config";
import type {
	SerializedGameState,
	SerializedLabState,
	SerializedResourceState,
} from "@/game/state/serialization";
import { serializeGameState } from "@/game/state/serialization";
import type { LabId, ResearchId, ShopBoosts } from "@/game/types";
import { bigNum, bnDeserialize, bnSerialize } from "@/lib/big-number";
import { buildSyncSnapshot, checkPlausibility } from "./plausibility";
import type { SyncSnapshot } from "./redis";

const noBoosts: ShopBoosts = {
	"production-20x": false,
	"automation-2x": false,
	"runtime-50": false,
	"research-2x": false,
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

	it("includes research levels in snapshot", () => {
		const base = serializeGameState(createInitialGameState());
		const state = {
			...base,
			research: { ...base.research, "more-iron-ore": 3 } as Record<
				ResearchId,
				number
			>,
		};
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		expect(snapshot.research).toBeDefined();
		expect(snapshot.research?.["more-iron-ore"]).toBe(3);
	});

	it("includes all research IDs in snapshot", () => {
		const state = serializeGameState(createInitialGameState());
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		for (const id of RESEARCH_ORDER) {
			expect(snapshot.research?.[id]).toBeDefined();
		}
	});

	it("includes lab states in snapshot", () => {
		const base = serializeGameState(createInitialGameState());
		const state = {
			...base,
			labs: {
				...base.labs,
				"lab-1": {
					isUnlocked: true,
					activeResearchId: "more-iron-ore" as ResearchId,
					researchStartedAt: 12345,
				},
			} as Record<LabId, SerializedLabState>,
		};
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		expect(snapshot.labs).toBeDefined();
		expect(snapshot.labs?.["lab-1"].activeResearchId).toBe("more-iron-ore");
		expect(snapshot.labs?.["lab-1"].researchStartedAt).toBe(12345);
	});

	it("includes all lab IDs in snapshot", () => {
		const state = serializeGameState(createInitialGameState());
		const snapshot = buildSyncSnapshot({ state, timestamp: 0 });
		for (const id of LAB_ORDER) {
			expect(snapshot.labs?.[id]).toBeDefined();
		}
	});

	it("defaults research to 0 when state has no research field", () => {
		const base = serializeGameState(createInitialGameState());
		const stateWithoutResearch = { ...base };
		delete (stateWithoutResearch as Record<string, unknown>).research;
		const snapshot = buildSyncSnapshot({
			state: stateWithoutResearch,
			timestamp: 0,
		});
		expect(snapshot.research?.["more-iron-ore"]).toBe(0);
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
			expect(result.warnings[0]).toContain("locked/paused");
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

		it("warning message includes the resource name and excess percentage", () => {
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
			expect(result.warnings[0]).toContain("exceeded plausible rate by");
			expect(result.warnings[0]).toContain("%");
			expect(result.warnings[0]).toContain("gained:");
			expect(result.warnings[0]).toContain("max:");
			expect(result.warnings[0]).toContain("elapsed:");
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
				{
					"production-20x": true,
					"automation-2x": false,
					"runtime-50": false,
					"research-2x": false,
				},
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
				{
					"production-20x": true,
					"automation-2x": false,
					"runtime-50": false,
					"research-2x": false,
				},
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
				{
					"production-20x": false,
					"automation-2x": false,
					"runtime-50": true,
					"research-2x": false,
				},
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
				{
					"production-20x": false,
					"automation-2x": true,
					"runtime-50": false,
					"research-2x": false,
				},
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

	describe("research plausibility", () => {
		// Helper: create a claimed state with research and lab overrides
		const makeResearchClaimedState = ({
			researchOverrides = {},
			labOverrides = {},
			boosts = noBoosts,
		}: {
			researchOverrides?: Partial<Record<ResearchId, number>>;
			labOverrides?: Partial<Record<LabId, SerializedLabState>>;
			boosts?: ShopBoosts;
		} = {}): SerializedGameState => {
			const base = serializeGameState(createInitialGameState());
			return {
				...base,
				shopBoosts: boosts,
				research: {
					...base.research,
					...researchOverrides,
				} as Record<ResearchId, number>,
				labs: {
					...base.labs,
					...labOverrides,
				} as Record<LabId, SerializedLabState>,
			};
		};

		// Helper: create a snapshot with research and lab fields
		const makeResearchSnapshot = ({
			timestamp,
			researchOverrides = {},
			labOverrides = {},
		}: {
			timestamp: number;
			researchOverrides?: Partial<Record<ResearchId, number>>;
			labOverrides?: Partial<
				Record<
					LabId,
					{
						activeResearchId: ResearchId | null;
						researchStartedAt: number | null;
					}
				>
			>;
		}): SyncSnapshot => {
			const base = serializeGameState(createInitialGameState());
			const snapshot = buildSyncSnapshot({ state: base, timestamp });
			if (!snapshot.research || !snapshot.labs) {
				throw new Error("Expected snapshot to have research and labs");
			}
			return {
				...snapshot,
				research: { ...snapshot.research, ...researchOverrides },
				labs: { ...snapshot.labs, ...labOverrides },
			};
		};

		const assertCorrected = (
			result: ReturnType<typeof checkPlausibility>,
		): NonNullable<ReturnType<typeof checkPlausibility>["correctedState"]> => {
			if (!result.correctedState) {
				throw new Error("Expected correctedState to be non-null");
			}
			return result.correctedState;
		};

		it("skips research validation for old snapshots without research field", () => {
			const t0 = 0;
			const snapshot = makeSnapshot(t0);
			// Remove research/labs fields to simulate old snapshot
			const oldSnapshot: SyncSnapshot = {
				timestamp: snapshot.timestamp,
				resources: snapshot.resources,
			};
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 10 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: oldSnapshot,
				serverNow: t0 + 1000,
			});
			// Should not correct research (no data to compare against)
			expect(result.corrected).toBe(false);
		});

		it("no correction when research level unchanged", () => {
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 3 },
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 3 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});

		it("no correction when research level decreased (reset)", () => {
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 5 },
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 0 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(false);
		});

		it("no correction for legitimate single-level advancement", () => {
			// Level 0→1 requires 10s = 10,000ms. Give 11,000ms elapsed.
			const t0 = 1000;
			const startedAt = t0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: startedAt,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 1 },
				labOverrides: {
					"lab-1": {
						isUnlocked: true,
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0 + 10_000,
					},
				},
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 11_000,
			});
			expect(result.corrected).toBe(false);
		});

		it("no correction for legitimate multi-level advancement", () => {
			// Level 0→1: 10s, level 1→2: 20s. Total 30s. Give 35s elapsed.
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 2 },
				labOverrides: {
					"lab-1": {
						isUnlocked: true,
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0 + 30_000,
					},
				},
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 35_000,
			});
			expect(result.corrected).toBe(false);
		});

		it("corrects research level exceeding time-based max", () => {
			// Level 0→1 requires 10s. Only 5s elapsed. Claimed level 5.
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 5 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 5_000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			expect(state.research?.["more-iron-ore"]).toBe(0);
			const warning = result.warnings.find((w) => w.includes("more-iron-ore"));
			expect(warning).toBeDefined();
			expect(warning).toContain("claimed: 5");
			expect(warning).toContain("max: 0");
			expect(warning).toContain("elapsed:");
		});

		it("corrects research level manipulation with no active lab", () => {
			// No lab researching this, but claimed level jumped from 0 to 10
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 10 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 15_000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			expect(state.research?.["more-iron-ore"]).toBe(0);
		});

		it("allows +1 tolerance for clock skew", () => {
			// Level 0→1 requires 10s. Only 9s elapsed. maxAchievable=0, claimed=1.
			// 1 <= 0 + 1, so no correction.
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 1 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 9_000,
			});
			expect(result.corrected).toBe(false);
		});

		it("corrects beyond +1 tolerance", () => {
			// maxAchievable=0, claimed=2. 2 > 0+1 → corrected to 0.
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 2 },
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 9_000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			expect(state.research?.["more-iron-ore"]).toBe(0);
		});

		it("respects research-2x boost when computing max achievable", () => {
			// With research-2x, level 0→1 takes 5s instead of 10s.
			// 6s elapsed with boost → maxAchievable=1. Claimed=1 → no correction.
			const t0 = 0;
			const boosts: ShopBoosts = {
				...noBoosts,
				"research-2x": true,
			};
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 1 },
				boosts,
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 6_000,
			});
			expect(result.corrected).toBe(false);
		});

		it("corrects backdated researchStartedAt for same research", () => {
			const t0 = 5000;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			// Client backdated researchStartedAt to before snapshot
			const claimed = makeResearchClaimedState({
				labOverrides: {
					"lab-1": {
						isUnlocked: true,
						activeResearchId: "more-iron-ore",
						researchStartedAt: 1000,
					},
				},
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			expect(state.labs?.["lab-1"].researchStartedAt).toBe(t0);
			expect(result.warnings.some((w) => w.includes("backdated"))).toBe(true);
		});

		it("corrects backdated researchStartedAt for new assignment", () => {
			const t0 = 5000;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				labOverrides: {
					"lab-1": {
						activeResearchId: null,
						researchStartedAt: null,
					},
				},
			});
			// Client assigned new research but backdated the start
			const claimed = makeResearchClaimedState({
				labOverrides: {
					"lab-1": {
						isUnlocked: true,
						activeResearchId: "more-iron-ore",
						researchStartedAt: 1000,
					},
				},
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			expect(state.labs?.["lab-1"].researchStartedAt).toBe(t0);
			expect(result.warnings.some((w) => w.includes("backdated"))).toBe(true);
		});

		it("corrects future researchStartedAt", () => {
			const t0 = 5000;
			const serverNow = t0 + 1000;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				labOverrides: {
					"lab-1": {
						activeResearchId: "more-iron-ore",
						researchStartedAt: t0,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				labOverrides: {
					"lab-1": {
						isUnlocked: true,
						activeResearchId: "more-iron-ore",
						researchStartedAt: serverNow + 100_000,
					},
				},
			});
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			expect(state.labs?.["lab-1"].researchStartedAt).toBe(serverNow);
			expect(result.warnings.some((w) => w.includes("future"))).toBe(true);
		});

		it("allows post-snapshot lab assignment with legitimate advancement", () => {
			// Lab was idle at snapshot, assigned after snapshot, enough time for 1 level
			const t0 = 0;
			const assignedAt = t0 + 2000;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
				labOverrides: {
					"lab-1": {
						activeResearchId: null,
						researchStartedAt: null,
					},
				},
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 1 },
				labOverrides: {
					"lab-1": {
						isUnlocked: true,
						activeResearchId: "more-iron-ore",
						researchStartedAt: assignedAt + 10_000,
					},
				},
			});
			// serverNow = assignedAt + 11s (enough for level 0→1 at 10s)
			const result = checkPlausibility({
				claimedState: claimed,
				lastSnapshot: snapshot,
				serverNow: assignedAt + 11_000,
			});
			expect(result.corrected).toBe(false);
		});

		it("speed research increases production tolerance", () => {
			// Speed research at level 5 → speedResearchMul = 1/(1+5*0.1) = 0.667
			// This halves effective run time, allowing more runs → more production
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "speed-iron-ore": 5 },
			});
			// Without speed research: maxRuns = floor(1000/1000)+1 = 2
			// maxProd = 2*1*1*1 = 2, tolerance = 2.2
			// With speed-5: rtm=0.667, runTime=0.667s=667ms
			// maxRuns = floor(1000/667)+1 = 2, maxProd=2, tolerance=2.2
			// With 2s: rtm=0.667, runTime=667ms, maxRuns=floor(2000/667)+1=4
			// maxProd=4, tolerance=4.4
			const claimed = makeResearchClaimedState({
				researchOverrides: { "speed-iron-ore": 5 },
			});
			const claimedWithProduction = {
				...claimed,
				resources: {
					...claimed.resources,
					"iron-ore": {
						...claimed.resources["iron-ore"],
						amount: bnSerialize(bigNum(4)),
					},
				},
			};
			const result = checkPlausibility({
				claimedState: claimedWithProduction,
				lastSnapshot: snapshot,
				serverNow: t0 + 2000,
			});
			// 4 <= 4.4 → no correction
			expect(result.corrected).toBe(false);
		});

		it("without speed research, same production is corrected", () => {
			// Same scenario as above but without speed research
			const t0 = 0;
			const snapshot = makeResearchSnapshot({ timestamp: t0 });
			const claimed = makeResearchClaimedState({});
			const claimedWithProduction = {
				...claimed,
				resources: {
					...claimed.resources,
					"iron-ore": {
						...claimed.resources["iron-ore"],
						amount: bnSerialize(bigNum(4)),
					},
				},
			};
			const result = checkPlausibility({
				claimedState: claimedWithProduction,
				lastSnapshot: snapshot,
				serverNow: t0 + 2000,
			});
			// Without speed research: rtm=1, runTime=1s=1000ms
			// maxRuns = floor(2000/1000)+1 = 3, maxProd=3, tolerance=3.3
			// 4 > 3.3 → corrected
			expect(result.corrected).toBe(true);
		});

		it("inflated research no longer inflates production tolerance", () => {
			// Previously: inflated research level would increase researchMul,
			// allowing more production to pass. Now validated research is used.
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
			});
			// Claim research level 10 (no lab researching = impossible)
			// AND claim high production that would only pass with research bonus
			// researchMul at level 10 = 1 + 10*0.1 = 2.0
			// Without research: maxProd = 2*1*1*1 = 2, tolerance = 2.2
			// With cheated research: maxProd = 2*1*1*2 = 4, tolerance = 4.4
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 10 },
			});
			// Override iron-ore amount to 4 (would pass with inflated research, fail without)
			const claimedWithProduction = {
				...claimed,
				resources: {
					...claimed.resources,
					"iron-ore": {
						...claimed.resources["iron-ore"],
						amount: bnSerialize(bigNum(4)),
					},
				},
			};
			const result = checkPlausibility({
				claimedState: claimedWithProduction,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			// Research should be corrected
			expect(state.research?.["more-iron-ore"]).toBe(0);
			// Production should also be corrected (gain=4 > tolerance=2.2 with validated level 0)
			expect(result.warnings.some((w) => w.includes("Iron Ore"))).toBe(true);
		});

		it("corrected state includes both resource and research corrections", () => {
			const t0 = 0;
			const snapshot = makeResearchSnapshot({
				timestamp: t0,
				researchOverrides: { "more-iron-ore": 0 },
			});
			const claimed = makeResearchClaimedState({
				researchOverrides: { "more-iron-ore": 10 },
			});
			const claimedWithProduction = {
				...claimed,
				resources: {
					...claimed.resources,
					"iron-ore": {
						...claimed.resources["iron-ore"],
						amount: bnSerialize(bigNum(100)),
					},
				},
			};
			const result = checkPlausibility({
				claimedState: claimedWithProduction,
				lastSnapshot: snapshot,
				serverNow: t0 + 1000,
			});
			expect(result.corrected).toBe(true);
			const state = assertCorrected(result);
			// Both research and resources should be in corrected state
			expect(state.research).toBeDefined();
			expect(state.resources).toBeDefined();
			expect(state.research?.["more-iron-ore"]).toBe(0);
		});
	});
});
