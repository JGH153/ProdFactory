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
	canStartRun,
	completeRun,
	getEffectiveRunTime,
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
	const milestoneQueueRef = useRef<
		{ resourceId: ResourceId; multiplier: number }[]
	>([]);

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
		(serverSerialized: SerializedGameState, fullReplace: boolean) => {
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

	const { enqueueAction, resetOnServer } = useServerSync(
		stateRef,
		reconcileState,
	);

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
						isRunComplete(
							resource,
							getEffectiveRunTime(resourceId, resource.producers),
						)
					) {
						next = completeRun(next, resourceId);
						changed = true;
					}

					// Auto-start runs for automated resources that are idle and not paused
					const updated = next.resources[resourceId];
					if (
						updated.isAutomated &&
						!updated.isPaused &&
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

	// --- Action callbacks (optimistic + server) ---

	const startResourceRun = useCallback((resourceId: ResourceId) => {
		setState((current) => startRun(current, resourceId));
	}, []);

	const buyResourceProducer = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => {
				const before = current.resources[resourceId].producers;
				const next = buyProducer(current, resourceId);
				const after = next.resources[resourceId].producers;
				const milestoneBefore = Math.floor(before / SPEED_MILESTONE_INTERVAL);
				const milestoneAfter = Math.floor(after / SPEED_MILESTONE_INTERVAL);
				if (milestoneAfter > milestoneBefore) {
					milestoneQueueRef.current.push({
						resourceId,
						multiplier: 2 ** milestoneAfter,
					});
				}
				return next;
			});
			for (const m of milestoneQueueRef.current) {
				showMilestone(m.resourceId, m.multiplier);
			}
			milestoneQueueRef.current = [];
			enqueueAction("buy-producer", resourceId);
		},
		[enqueueAction, showMilestone],
	);

	const buyMaxResourceProducers = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => {
				const before = current.resources[resourceId].producers;
				const next = buyMaxProducers(current, resourceId);
				const after = next.resources[resourceId].producers;
				const milestoneBefore = Math.floor(before / SPEED_MILESTONE_INTERVAL);
				const milestoneAfter = Math.floor(after / SPEED_MILESTONE_INTERVAL);
				if (milestoneAfter > milestoneBefore) {
					milestoneQueueRef.current.push({
						resourceId,
						multiplier: 2 ** milestoneAfter,
					});
				}
				return next;
			});
			for (const m of milestoneQueueRef.current) {
				showMilestone(m.resourceId, m.multiplier);
			}
			milestoneQueueRef.current = [];
			enqueueAction("buy-max-producers", resourceId);
		},
		[enqueueAction, showMilestone],
	);

	const buyResourceAutomation = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => buyAutomation(current, resourceId));
			enqueueAction("buy-automation", resourceId);
		},
		[enqueueAction],
	);

	const toggleResourcePause = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => togglePause(current, resourceId));
			enqueueAction("toggle-pause", resourceId);
		},
		[enqueueAction],
	);

	const unlockResourceTier = useCallback(
		(resourceId: ResourceId) => {
			setState((current) => unlockResource(current, resourceId));
			enqueueAction("unlock", resourceId);
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
