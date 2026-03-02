import { bigNum } from "@/lib/big-number";
import { createInitialGameState } from "./initial-state";
import type { GameState } from "./types";

/** Build a state with overrides for iron-ore. */
export const withIronOre = (
	overrides: Partial<GameState["resources"]["iron-ore"]>,
): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		resources: {
			...state.resources,
			"iron-ore": { ...state.resources["iron-ore"], ...overrides },
		},
	};
};

/** Build a state with a given iron-ore amount and optional plates overrides. */
export const withPlates = (
	ironOreAmount: number,
	platesOverrides?: Partial<GameState["resources"]["plates"]>,
): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		resources: {
			...state.resources,
			"iron-ore": {
				...state.resources["iron-ore"],
				amount: bigNum(ironOreAmount),
			},
			plates: { ...state.resources.plates, ...platesOverrides },
		},
	};
};

/** Build a state with nuclear pasta produced this run. */
export const withNuclearPasta = (amount: number): GameState => {
	const state = createInitialGameState();
	return {
		...state,
		prestige: {
			...state.prestige,
			nuclearPastaProducedThisRun: bigNum(amount),
		},
	};
};
