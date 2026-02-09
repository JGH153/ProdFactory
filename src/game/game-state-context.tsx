"use client";

import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "./config";
import { createInitialGameState } from "./initial-state";
import {
	buyAutomation,
	buyProducer,
	canStartRun,
	completeRun,
	isRunComplete,
	startRun,
	unlockResource,
} from "./logic";
import { clearSave, loadGame, saveGame } from "./persistence";
import type { GameState, ResourceId } from "./types";

const AUTO_SAVE_INTERVAL_MS = 5000;

type GameActions = {
	state: GameState;
	startResourceRun: (resourceId: ResourceId) => void;
	buyResourceProducer: (resourceId: ResourceId) => void;
	buyResourceAutomation: (resourceId: ResourceId) => void;
	unlockResourceTier: (resourceId: ResourceId) => void;
	resetGame: () => void;
};

const GameStateContext = createContext<GameActions | null>(null);

export const GameStateProvider = ({ children }: PropsWithChildren) => {
	const [state, setState] = useState<GameState>(createInitialGameState);
	const stateRef = useRef(state);
	const hasLoadedRef = useRef(false);

	// Load from localStorage on mount (client-only)
	useEffect(() => {
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true;
			setState(loadGame());
		}
	}, []);

	// Keep stateRef in sync
	stateRef.current = state;

	// Game tick: check run completions via requestAnimationFrame
	useEffect(() => {
		let rafId: number;

		const tick = () => {
			setState((current) => {
				let next = current;
				let changed = false;

				for (const resourceId of RESOURCE_ORDER) {
					const resource = next.resources[resourceId];
					const config = RESOURCE_CONFIGS[resourceId];

					if (isRunComplete(resource, config.baseRunTime)) {
						next = completeRun(next, resourceId);
						changed = true;
					}

					// Auto-start runs for automated resources that are idle
					const updated = next.resources[resourceId];
					if (
						updated.isAutomated &&
						updated.runStartedAt === null &&
						canStartRun(next, resourceId)
					) {
						next = startRun(next, resourceId);
						changed = true;
					}
				}

				return changed ? next : current;
			});

			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafId);
	}, []);

	// Auto-save every 5 seconds
	useEffect(() => {
		const interval = setInterval(() => {
			saveGame(stateRef.current);
		}, AUTO_SAVE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, []);

	const startResourceRun = useCallback((resourceId: ResourceId) => {
		setState((current) => startRun(current, resourceId));
	}, []);

	const buyResourceProducer = useCallback((resourceId: ResourceId) => {
		setState((current) => buyProducer(current, resourceId));
	}, []);

	const buyResourceAutomation = useCallback((resourceId: ResourceId) => {
		setState((current) => buyAutomation(current, resourceId));
	}, []);

	const unlockResourceTier = useCallback((resourceId: ResourceId) => {
		setState((current) => unlockResource(current, resourceId));
	}, []);

	const resetGame = useCallback(() => {
		clearSave();
		setState(createInitialGameState());
	}, []);

	const value: GameActions = {
		state,
		startResourceRun,
		buyResourceProducer,
		buyResourceAutomation,
		unlockResourceTier,
		resetGame,
	};

	return <GameStateContext value={value}>{children}</GameStateContext>;
};

export const useGameState = (): GameActions => {
	const context = use(GameStateContext);
	if (!context) {
		throw new Error("useGameState must be used within GameStateProvider");
	}
	return context;
};
