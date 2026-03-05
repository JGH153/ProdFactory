import { describe, expect, it } from "vitest";
import { RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { bigNum, bigNumZero } from "@/lib/big-number";
import {
	deserializeGameState,
	SAVE_VERSION,
	serializeGameState,
} from "./serialization";

describe("serializeGameState", () => {
	it("output version matches SAVE_VERSION", () => {
		const state = createInitialGameState();
		const serialized = serializeGameState(state);
		expect(serialized.version).toBe(SAVE_VERSION);
	});

	it("lastSavedAt is a recent timestamp", () => {
		const before = Date.now();
		const serialized = serializeGameState(createInitialGameState());
		const after = Date.now();
		expect(serialized.lastSavedAt).toBeGreaterThanOrEqual(before);
		expect(serialized.lastSavedAt).toBeLessThanOrEqual(after);
	});

	it("all 8 resource IDs are present in serialized resources", () => {
		const serialized = serializeGameState(createInitialGameState());
		for (const id of RESOURCE_ORDER) {
			expect(serialized.resources[id]).toBeDefined();
		}
	});

	it("iron-ore amount serializes to {m:0, e:0} for initial state", () => {
		const serialized = serializeGameState(createInitialGameState());
		expect(serialized.resources["iron-ore"].amount).toEqual({ m: 0, e: 0 });
	});

	it("non-zero amount serializes correctly: bigNum(100) → {m:1, e:2}", () => {
		const state = createInitialGameState();
		const modified = {
			...state,
			resources: {
				...state.resources,
				"iron-ore": { ...state.resources["iron-ore"], amount: bigNum(100) },
			},
		};
		const serialized = serializeGameState(modified);
		expect(serialized.resources["iron-ore"].amount).toEqual({ m: 1, e: 2 });
	});

	it("shopBoosts are included in serialized state", () => {
		const state = createInitialGameState();
		const serialized = serializeGameState(state);
		expect(serialized.shopBoosts).toEqual(state.shopBoosts);
	});
});

describe("deserializeGameState", () => {
	it("round-trip of initial state produces equivalent resources", () => {
		const state = createInitialGameState();
		const result = deserializeGameState(serializeGameState(state));
		for (const id of RESOURCE_ORDER) {
			expect(result.resources[id].producers).toBe(
				state.resources[id].producers,
			);
			expect(result.resources[id].isUnlocked).toBe(
				state.resources[id].isUnlocked,
			);
			expect(result.resources[id].isAutomated).toBe(
				state.resources[id].isAutomated,
			);
			expect(result.resources[id].amount).toEqual(bigNumZero);
		}
	});

	it("non-zero amount survives round-trip", () => {
		const state = createInitialGameState();
		const modified = {
			...state,
			resources: {
				...state.resources,
				"iron-ore": { ...state.resources["iron-ore"], amount: bigNum(1234567) },
			},
		};
		const result = deserializeGameState(serializeGameState(modified));
		const amount = result.resources["iron-ore"].amount;
		expect(amount.exponent).toBe(6);
		expect(amount.mantissa).toBeCloseTo(1.234567, 5);
	});

	it("runStartedAt number survives round-trip", () => {
		const ts = 1700000000000;
		const state = createInitialGameState();
		const modified = {
			...state,
			resources: {
				...state.resources,
				"iron-ore": { ...state.resources["iron-ore"], runStartedAt: ts },
			},
		};
		const result = deserializeGameState(serializeGameState(modified));
		expect(result.resources["iron-ore"].runStartedAt).toBe(ts);
	});

	it("migrates legacy production-20x to production-2x", () => {
		const state = createInitialGameState();
		const serialized = serializeGameState(state);
		// Simulate a legacy save with old key
		const legacy = {
			...serialized,
			shopBoosts: {
				"production-20x": true,
				"automation-2x": false,
				"runtime-50": false,
				"research-2x": false,
				"offline-2h": false,
			},
		};
		const result = deserializeGameState(
			legacy as unknown as ReturnType<typeof serializeGameState>,
		);
		expect(result.shopBoosts["production-2x"]).toBe(true);
		expect("production-20x" in result.shopBoosts).toBe(false);
	});

	it("isPaused=true survives round-trip", () => {
		const state = createInitialGameState();
		const modified = {
			...state,
			resources: {
				...state.resources,
				"iron-ore": { ...state.resources["iron-ore"], isPaused: true },
			},
		};
		const result = deserializeGameState(serializeGameState(modified));
		expect(result.resources["iron-ore"].isPaused).toBe(true);
	});
});
