import { describe, expect, it } from "vitest";
import { createInitialGameState } from "./initial-state";
import { isTrackUnlocked } from "./music-unlock";

const makeUpgrades = (overrides: Record<string, number> = {}) => {
	const state = createInitialGameState();
	return { ...state.couponUpgrades, ...overrides };
};

describe("isTrackUnlocked", () => {
	it("cave is always unlocked", () => {
		expect(
			isTrackUnlocked({ trackId: "cave", couponUpgrades: makeUpgrades() }),
		).toBe(true);
	});

	it("gemini is locked by default", () => {
		expect(
			isTrackUnlocked({ trackId: "gemini", couponUpgrades: makeUpgrades() }),
		).toBe(false);
	});

	it("gemini is unlocked when music-gemini upgrade is purchased", () => {
		expect(
			isTrackUnlocked({
				trackId: "gemini",
				couponUpgrades: makeUpgrades({ "music-gemini": 1 }),
			}),
		).toBe(true);
	});

	it("gemini-calm is locked by default", () => {
		expect(
			isTrackUnlocked({
				trackId: "gemini-calm",
				couponUpgrades: makeUpgrades(),
			}),
		).toBe(false);
	});

	it("gemini-calm is unlocked when music-gemini-calm upgrade is purchased", () => {
		expect(
			isTrackUnlocked({
				trackId: "gemini-calm",
				couponUpgrades: makeUpgrades({ "music-gemini-calm": 1 }),
			}),
		).toBe(true);
	});

	it("classic is locked by default", () => {
		expect(
			isTrackUnlocked({ trackId: "classic", couponUpgrades: makeUpgrades() }),
		).toBe(false);
	});

	it("classic is unlocked when music-classic upgrade is purchased", () => {
		expect(
			isTrackUnlocked({
				trackId: "classic",
				couponUpgrades: makeUpgrades({ "music-classic": 1 }),
			}),
		).toBe(true);
	});
});
