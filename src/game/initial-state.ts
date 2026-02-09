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
			runStartedAt: null,
		},
		plates: {
			id: "plates",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"reinforced-plate": {
			id: "reinforced-plate",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
		"modular-frame": {
			id: "modular-frame",
			amount: bigNumZero,
			producers: 0,
			isUnlocked: false,
			isAutomated: false,
			runStartedAt: null,
		},
	},
	lastSavedAt: Date.now(),
});
