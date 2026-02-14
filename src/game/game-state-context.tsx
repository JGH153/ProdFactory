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
import { RESOURCE_ORDER } from "./config";
import { createInitialGameState } from "./initial-state";
import {
	buyAutomation,
	buyMaxProducers,
	buyProducer,
	canBuyProducer,
	canStartRun,
	completeRun,
	getClampedRunTime,
	isRunComplete,
	SPEED_MILESTONE_INTERVAL,
	startRun,
	togglePause,
	unlockResource,
} from "./logic";
import { useMilestoneNotification } from "./milestone-context";
import { clearSave, loadGame, saveGame } from "./persistence";
import type { SerializedGameState } from "./serialization";
import { deserializeGameState } from "./serialization";
import type { GameState, ResourceId, ResourceState } from "./types";
import { useServerSync } from "./use-server-sync";

type GameActions = {
	state: GameState;
	startResourceRun: (resourceId: ResourceId) => void;
	buyResourceProducer: (resourceId: ResourceId) => void;
	buyMaxResourceProducers: (resourceId: ResourceId) => void;
	buyResourceAutomation: (resourceId: ResourceId) => void;
	toggleResourcePause: (resourceId: ResourceId) => void;
	unlockResourceTier: (resourceId: ResourceId) => void;
	resetGame: () => void;
};

const GameStateContext = createContext<GameActions | null>(null);

export const GameStateProvider = ({ children }: PropsWithChildren) => {
	const [state, setState] = useState<GameState>(createInitialGameState);
	const stateRef = useRef(state);
	const hasLoadedRef = useRef(false);
	const { showMilestone } = useMilestoneNotification();

	// Load from localStorage on mount (client-only, instant render)
	useEffect(() => {
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true;
			setState(loadGame());
		}
	}, []);

	// Keep stateRef in sync
	stateRef.current = state;

	// --- Server reconciliation ---

	const reconcileState = useCallback(
		({
			state: serverSerialized,
			fullReplace,
		}: {
			state: SerializedGameState;
			fullReplace: boolean;
		}) => {
			const serverState = deserializeGameState(serverSerialized);
			if (fullReplace) {
				setState(serverState);
			} else {
				setState((current) => {
					const resources = {} as Record<ResourceId, ResourceState>;
					for (const id of RESOURCE_ORDER) {
						resources[id] = {
							...serverState.resources[id],
							runStartedAt: current.resources[id].runStartedAt,
						};
					}
					return { resources, lastSavedAt: serverState.lastSavedAt };
				});
			}
			saveGame(serverState);
		},
		[],
	);

	// --- Server sync hook (save/sync intervals, action queue) ---

	const { enqueueAction, resetOnServer } = useServerSync({
		stateRef,
		reconcileState,
	});

	// Game tick: check run completions via requestAnimationFrame
	useEffect(() => {
		let rafId: number;

		const tick = () => {
			setState((current) => {
				let next = current;
				let changed = false;

				for (const resourceId of RESOURCE_ORDER) {
					const resource = next.resources[resourceId];

					if (
						isRunComplete({
							resource,
							runTime: getClampedRunTime({
								resourceId,
								producers: resource.producers,
							}),
						})
					) {
						next = completeRun({ state: next, resourceId });
						changed = true;
					}

					// Auto-start runs for automated resources that are idle and not paused
					const updated = next.resources[resourceId];
					if (
						updated.isAutomated &&
						!updated.isPaused &&
						updated.runStartedAt === null &&
						canStartRun({ state: next, resourceId })
					) {
						next = startRun({ state: next, resourceId });
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

	// --- Action callbacks (optimistic + server) ---

	const startResourceRun = useCallback((resourceId: ResourceId) => {
		setState((current) => startRun({ state: current, resourceId }));
	}, []);

	const buyResourceProducer = useCallback(
		(resourceId: ResourceId) => {
			const currentState = stateRef.current;
			const before = currentState.resources[resourceId].producers;
			setState((current) => buyProducer({ state: current, resourceId }));
			if (canBuyProducer({ state: currentState, resourceId })) {
				const after = before + 1;
				const milestoneBefore = Math.floor(before / SPEED_MILESTONE_INTERVAL);
				const milestoneAfter = Math.floor(after / SPEED_MILESTONE_INTERVAL);
				if (milestoneAfter > milestoneBefore) {
					showMilestone({ resourceId, multiplier: 2 ** milestoneAfter });
				}
			}
			enqueueAction({ endpoint: "buy-producer", resourceId });
		},
		[enqueueAction, showMilestone],
	);

	const buyMaxResourceProducers = useCallback(
		(resourceId: ResourceId) => {
			const currentState = stateRef.current;
			const before = currentState.resources[resourceId].producers;
			const simResult = buyMaxProducers({ state: currentState, resourceId });
			const after = simResult.resources[resourceId].producers;
			setState((current) => buyMaxProducers({ state: current, resourceId }));
			const milestoneBefore = Math.floor(before / SPEED_MILESTONE_INTERVAL);
			const milestoneAfter = Math.floor(after / SPEED_MILESTONE_INTERVAL);
			if (milestoneAfter > milestoneBefore) {
				showMilestone({ resourceId, multiplier: 2 ** milestoneAfter });
			}
			enqueueAction({ endpoint: "buy-max-producers", resourceId });
		},
		[enqueueAction, showMilestone],
	);

	const buyResourceAutomation = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => buyAutomation({ state: current, resourceId }));
			enqueueAction({ endpoint: "buy-automation", resourceId });
		},
		[enqueueAction],
	);

	const toggleResourcePause = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => togglePause({ state: current, resourceId }));
			enqueueAction({ endpoint: "toggle-pause", resourceId });
		},
		[enqueueAction],
	);

	const unlockResourceTier = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => unlockResource({ state: current, resourceId }));
			enqueueAction({ endpoint: "unlock", resourceId });
		},
		[enqueueAction],
	);

	const resetGame = useCallback(() => {
		clearSave();
		setState(createInitialGameState());
		resetOnServer();
	}, [resetOnServer]);

	const value: GameActions = {
		state,
		startResourceRun,
		buyResourceProducer,
		buyMaxResourceProducers,
		buyResourceAutomation,
		toggleResourcePause,
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
