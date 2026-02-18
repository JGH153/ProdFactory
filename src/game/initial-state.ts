import { bigNumZero } from "@/lib/big-number";
import type { GameState } from "./types";

export const createInitialGameState = (): GameState => ({
	resources: {
		"iron-ore": {
			id: "iron-ore",
			amount: bigNumZero,
			producers: 1,
			isUnlocked: true,
			isAutomated: false,
			isPaused: false,
			runStartedAt: null,
		},
		plates: {
			id: "plates",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			isPaused: false,
			runStartedAt: null,
		},
		"reinforced-plate": {
			id: "reinforced-plate",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			isPaused: false,
			runStartedAt: null,
		},
		"modular-frame": {
			id: "modular-frame",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			isPaused: false,
			runStartedAt: null,
		},
		"heavy-modular-frame": {
			id: "heavy-modular-frame",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			isPaused: false,
			runStartedAt: null,
		},
		"fused-modular-frame": {
			id: "fused-modular-frame",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			isPaused: false,
			runStartedAt: null,
		},
	},
	shopBoosts: {
		"production-20x": false,
		"automation-2x": false,
		"runtime-50": false,
	},
	lastSavedAt: Date.now(),
});
