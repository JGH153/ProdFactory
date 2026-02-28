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
import { RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import {
	buyAutomation,
	buyMaxProducers,
	buyProducer,
	canBuyProducer,
	canStartRun,
	completeRun,
	getClampedRunTime,
	getRunTimeMultiplier,
	isRunComplete,
	SPEED_MILESTONE_INTERVAL,
	startRun,
	togglePause,
} from "@/game/logic";
import {
	getSpeedResearchMultiplier,
	LAB_ORDER,
	RESEARCH_BONUS_PER_LEVEL,
	RESEARCH_CONFIGS,
} from "@/game/research-config";
import {
	advanceResearchWithReport,
	type ResearchLevelUp,
} from "@/game/research-logic";
import type {
	GameState,
	LabId,
	LabState,
	OfflineSummary,
	ResearchId,
	ResourceId,
	ResourceState,
	ShopBoostId,
} from "@/game/types";
import { useMilestoneNotification } from "./milestone-context";
import { clearSave, loadGame, saveGame } from "./persistence";
import type { SerializedGameState } from "./serialization";
import { deserializeGameState } from "./serialization";
import { useServerSync } from "./use-server-sync";

type GameActions = {
	state: GameState;
	offlineSummary: OfflineSummary | null;
	collectOfflineProgress: () => void;
	startResourceRun: (resourceId: ResourceId) => void;
	buyResourceProducer: (resourceId: ResourceId) => void;
	buyMaxResourceProducers: (resourceId: ResourceId) => void;
	buyResourceAutomation: (resourceId: ResourceId) => void;
	toggleResourcePause: (resourceId: ResourceId) => void;
	unlockResourceTier: (resourceId: ResourceId) => Promise<boolean>;
	activateShopBoost: (boostId: ShopBoostId) => Promise<boolean>;
	resetShopBoosts: () => Promise<boolean>;
	resetResearch: () => Promise<boolean>;
	assignLabResearch: (args: {
		labId: LabId;
		researchId: ResearchId;
	}) => Promise<boolean>;
	unassignLabResearch: (labId: LabId) => Promise<boolean>;
	unlockLab: (labId: LabId) => Promise<boolean>;
	resetGame: () => void;
};

const GameStateContext = createContext<GameActions | null>(null);

export const GameStateProvider = ({ children }: PropsWithChildren) => {
	const [state, setState] = useState<GameState>(createInitialGameState);
	const [offlineSummary, setOfflineSummary] = useState<OfflineSummary | null>(
		null,
	);
	const stateRef = useRef(state);
	const hasLoadedRef = useRef(false);
	const { showMilestone, showResearchLevelUp } = useMilestoneNotification();
	const pendingLevelUpsRef = useRef<ResearchLevelUp[]>([]);

	// Load from localStorage on mount (client-only, instant render)
	useEffect(() => {
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true;
			setState(loadGame());
		}
	}, []);

	stateRef.current = state;

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
					const labs = {} as Record<LabId, LabState>;
					for (const id of LAB_ORDER) {
						labs[id] = serverState.labs[id];
					}
					return {
						resources,
						shopBoosts: serverState.shopBoosts,
						labs,
						research: serverState.research,
						lastSavedAt: serverState.lastSavedAt,
					};
				});
			}
			saveGame(serverState);
		},
		[],
	);

	const onOfflineSummary = useCallback((summary: OfflineSummary) => {
		setOfflineSummary(summary);
	}, []);

	const collectOfflineProgress = useCallback(() => {
		setOfflineSummary(null);
	}, []);

	const { enqueueAction, executeAwaitedAction, resetOnServer } = useServerSync({
		stateRef,
		reconcileState,
		onOfflineSummary,
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
					const rtm = getRunTimeMultiplier({
						shopBoosts: next.shopBoosts,
						isAutomated: resource.isAutomated && !resource.isPaused,
						speedResearchMultiplier: getSpeedResearchMultiplier({
							research: next.research,
							resourceId,
						}),
					});

					if (
						isRunComplete({
							resource,
							runTime: getClampedRunTime({
								resourceId,
								producers: resource.producers,
								runTimeMultiplier: rtm,
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

				const researchResult = advanceResearchWithReport({
					state: next,
					now: Date.now(),
				});
				if (researchResult.state !== next) {
					next = researchResult.state;
					changed = true;
					pendingLevelUpsRef.current.push(...researchResult.levelUps);
				}

				return changed ? next : current;
			});

			// Dispatch research level-up notifications outside setState
			if (pendingLevelUpsRef.current.length > 0) {
				// Deduplicate: if a single tick jumped multiple levels for the same
				// research, only show the highest level reached.
				const best = new Map<ResearchId, number>();
				for (const { researchId, newLevel } of pendingLevelUpsRef.current) {
					const existing = best.get(researchId);
					if (existing === undefined || newLevel > existing) {
						best.set(researchId, newLevel);
					}
				}
				pendingLevelUpsRef.current = [];
				for (const [researchId, newLevel] of best) {
					const config = RESEARCH_CONFIGS[researchId];
					showResearchLevelUp({
						researchId,
						researchName: config.name,
						newLevel,
						bonusPercent: Math.round(newLevel * RESEARCH_BONUS_PER_LEVEL * 100),
					});
				}
			}

			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafId);
	}, [showResearchLevelUp]);

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
			for (let m = milestoneBefore + 1; m <= milestoneAfter; m++) {
				showMilestone({ resourceId, multiplier: 2 ** m });
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
		async (resourceId: ResourceId): Promise<boolean> => {
			try {
				const serverState = await executeAwaitedAction({
					endpoint: "unlock",
					resourceId,
				});
				reconcileState({ state: serverState, fullReplace: false });
				return true;
			} catch {
				return false;
			}
		},
		[executeAwaitedAction, reconcileState],
	);

	const activateShopBoost = useCallback(
		async (boostId: ShopBoostId): Promise<boolean> => {
			try {
				const serverState = await executeAwaitedAction({
					endpoint: "activate-boost",
					boostId,
				});
				reconcileState({ state: serverState, fullReplace: false });
				return true;
			} catch {
				return false;
			}
		},
		[executeAwaitedAction, reconcileState],
	);

	const resetShopBoosts = useCallback(async (): Promise<boolean> => {
		try {
			const serverState = await executeAwaitedAction({
				endpoint: "reset-shop-boosts",
			});
			reconcileState({ state: serverState, fullReplace: false });
			return true;
		} catch {
			return false;
		}
	}, [executeAwaitedAction, reconcileState]);

	const resetResearch = useCallback(async (): Promise<boolean> => {
		try {
			const serverState = await executeAwaitedAction({
				endpoint: "reset-research",
			});
			reconcileState({ state: serverState, fullReplace: false });
			return true;
		} catch {
			return false;
		}
	}, [executeAwaitedAction, reconcileState]);

	const assignLabResearch = useCallback(
		async ({
			labId,
			researchId,
		}: {
			labId: LabId;
			researchId: ResearchId;
		}): Promise<boolean> => {
			try {
				const serverState = await executeAwaitedAction({
					endpoint: "assign-research",
					labId,
					researchId,
				});
				reconcileState({ state: serverState, fullReplace: false });
				return true;
			} catch {
				return false;
			}
		},
		[executeAwaitedAction, reconcileState],
	);

	const unassignLabResearch = useCallback(
		async (labId: LabId): Promise<boolean> => {
			try {
				const serverState = await executeAwaitedAction({
					endpoint: "unassign-research",
					labId,
				});
				reconcileState({ state: serverState, fullReplace: false });
				return true;
			} catch {
				return false;
			}
		},
		[executeAwaitedAction, reconcileState],
	);

	const unlockLab = useCallback(
		async (labId: LabId): Promise<boolean> => {
			try {
				const serverState = await executeAwaitedAction({
					endpoint: "unlock-lab",
					labId,
				});
				reconcileState({ state: serverState, fullReplace: false });
				return true;
			} catch {
				return false;
			}
		},
		[executeAwaitedAction, reconcileState],
	);

	const resetGame = useCallback(() => {
		clearSave();
		setState(createInitialGameState());
		resetOnServer();
	}, [resetOnServer]);

	const value: GameActions = {
		state,
		offlineSummary,
		collectOfflineProgress,
		startResourceRun,
		buyResourceProducer,
		buyMaxResourceProducers,
		buyResourceAutomation,
		toggleResourcePause,
		unlockResourceTier,
		activateShopBoost,
		resetShopBoosts,
		resetResearch,
		assignLabResearch,
		unassignLabResearch,
		unlockLab,
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
