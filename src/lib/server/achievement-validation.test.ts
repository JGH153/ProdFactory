import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_ORDER } from "@/game/achievements/achievement-config";
import type { AchievementState } from "@/game/achievements/achievement-types";
import { createInitialAchievementState } from "@/game/achievements/achievement-types";
import { createInitialGameState } from "@/game/initial-state";
import { serializeGameState } from "@/game/state/serialization";
import type { ShopBoosts } from "@/game/types";
import { bigNum, bnSerialize } from "@/lib/big-number";
import { validateAchievements } from "./achievement-validation";

const initialSerialized = () => serializeGameState(createInitialGameState());

const allTrue = (): AchievementState => {
	const state = createInitialAchievementState();
	for (const id of ACHIEVEMENT_ORDER) {
		state[id] = true;
	}
	return state;
};

describe("validateAchievements", () => {
	it("rejects all claims when game state is initial", () => {
		const result = validateAchievements({
			protectedState: initialSerialized(),
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		for (const id of ACHIEVEMENT_ORDER) {
			expect(result[id]).toBe(false);
		}
	});

	it("preserves already-true server achievements regardless of client", () => {
		const server = createInitialAchievementState();
		server["iron-hoarder"] = true;

		const result = validateAchievements({
			protectedState: initialSerialized(),
			serverAchievements: server,
			clientAchievements: createInitialAchievementState(),
		});

		expect(result["iron-hoarder"]).toBe(true);
	});

	it("returns server state when no client achievements provided", () => {
		const server = createInitialAchievementState();
		server["full-chain"] = true;

		const result = validateAchievements({
			protectedState: initialSerialized(),
			serverAchievements: server,
		});

		expect(result).toBe(server);
	});

	it("accepts iron-hoarder when lifetimeProduced >= 1M", () => {
		const state = initialSerialized();
		state.resources["iron-ore"] = {
			...state.resources["iron-ore"],
			lifetimeProduced: bnSerialize(bigNum(1_000_000)),
		};

		const result = validateAchievements({
			protectedState: state,
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		expect(result["iron-hoarder"]).toBe(true);
	});

	it("rejects iron-hoarder when lifetimeProduced < 1M", () => {
		const state = initialSerialized();
		state.resources["iron-ore"] = {
			...state.resources["iron-ore"],
			lifetimeProduced: bnSerialize(bigNum(999_999)),
		};

		const result = validateAchievements({
			protectedState: state,
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		expect(result["iron-hoarder"]).toBe(false);
	});

	it("accepts full-chain when nuclear-pasta is unlocked", () => {
		const state = initialSerialized();
		state.resources["nuclear-pasta"] = {
			...state.resources["nuclear-pasta"],
			isUnlocked: true,
		};

		const result = validateAchievements({
			protectedState: state,
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		expect(result["full-chain"]).toBe(true);
	});

	it("accepts first-automation when a resource is automated", () => {
		const state = initialSerialized();
		state.resources["iron-ore"] = {
			...state.resources["iron-ore"],
			isAutomated: true,
		};

		const result = validateAchievements({
			protectedState: state,
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		expect(result["first-automation"]).toBe(true);
	});

	it("accepts producer-army-50 when total producers >= 50", () => {
		const state = initialSerialized();
		state.resources["iron-ore"] = {
			...state.resources["iron-ore"],
			producers: 50,
		};

		const result = validateAchievements({
			protectedState: state,
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		expect(result["producer-army-50"]).toBe(true);
	});

	it("accepts shop-spree when all boosts active", () => {
		const state = initialSerialized();
		state.shopBoosts = {
			"production-2x": true,
			"automation-2x": true,
			"runtime-50": true,
			"research-2x": true,
			"offline-2h": true,
		} satisfies ShopBoosts;

		const result = validateAchievements({
			protectedState: state,
			serverAchievements: null,
			clientAchievements: allTrue(),
		});

		expect(result["shop-spree"]).toBe(true);
	});

	it("does not deserialize state when no new claims exist", () => {
		const server = createInitialAchievementState();
		const client = createInitialAchievementState();

		const result = validateAchievements({
			protectedState: initialSerialized(),
			serverAchievements: server,
			clientAchievements: client,
		});

		expect(result).toBe(server);
	});
});
