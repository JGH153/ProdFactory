import { createInitialGameState } from "./initial-state";
import {
	deserializeGameState,
	SAVE_VERSION,
	type SerializedGameState,
	serializeGameState,
} from "./serialization";
import type { GameState } from "./types";

const STORAGE_KEY = "prodfactory-save";

export const saveGame = (state: GameState): void => {
	try {
		const serialized = serializeGameState(state);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
	} catch {
		// Silently fail — localStorage might be full or unavailable
	}
};

export const loadGame = (): GameState => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return createInitialGameState();
		}
		const parsed = JSON.parse(raw) as SerializedGameState;
		if (parsed.version !== SAVE_VERSION) {
			return createInitialGameState();
		}
		return deserializeGameState(parsed);
	} catch {
		return createInitialGameState();
	}
};

export const clearSave = (): void => {
	localStorage.removeItem(STORAGE_KEY);
};
