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
import { buyAutomation, togglePause } from "@/game/automation";
import { RESOURCE_ORDER } from "@/game/config";
import type { CouponUpgradeId } from "@/game/coupon-shop-config";
import { useAwaitedAction } from "@/game/hooks/use-awaited-action";
import { useGameLoop } from "@/game/hooks/use-game-loop";
import { createInitialGameState } from "@/game/initial-state";
import { buyMaxProducers, buyProducer, canBuyProducer } from "@/game/producers";
import { LAB_ORDER } from "@/game/research-config";
import { SPEED_MILESTONE_INTERVAL } from "@/game/run-timing";
import { startRun } from "@/game/runs";
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
import {
	deserializeGameState,
	deserializeOfflineSummary,
} from "./serialization";
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
	timeWarp: (durationSeconds: number) => Promise<boolean>;
	resetGame: () => void;
	buyCouponUpgrade: (upgradeId: CouponUpgradeId) => Promise<boolean>;
	prestige: () => Promise<boolean>;
	devBoost: () => Promise<boolean>;
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
						prestige: serverState.prestige,
						couponUpgrades: serverState.couponUpgrades,
						timeWarpCount: serverState.timeWarpCount,
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

	const {
		enqueueAction,
		executeAwaitedAction,
		executeTimeWarp,
		resetOnServer,
	} = useServerSync({
		stateRef,
		reconcileState,
		onOfflineSummary,
	});

	// Game tick: check run completions and advance research via RAF
	useGameLoop({ setState, showResearchLevelUp });

	// Awaited action helper for server-authoritative actions
	const performAwaitedAction = useAwaitedAction({
		executeAwaitedAction,
		reconcileState,
	});

	const startResourceRun = useCallback((resourceId: ResourceId) => {
		setState((current) => startRun({ state: current, resourceId }));
	}, []);

	const buyResourceProducer = useCallback(
		(resourceId: ResourceId) => {
			const currentState = stateRef.current;
			if (!canBuyProducer({ state: currentState, resourceId })) {
				return;
			}
			const before = currentState.resources[resourceId].producers;
			setState((current) => buyProducer({ state: current, resourceId }));
			const after = before + 1;
			const milestoneBefore = Math.floor(before / SPEED_MILESTONE_INTERVAL);
			const milestoneAfter = Math.floor(after / SPEED_MILESTONE_INTERVAL);
			if (milestoneAfter > milestoneBefore) {
				showMilestone({ resourceId, multiplier: 2 ** milestoneAfter });
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
			if (before === after) {
				return;
			}
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
		(resourceId: ResourceId) =>
			performAwaitedAction({ endpoint: "unlock", resourceId }),
		[performAwaitedAction],
	);

	const activateShopBoost = useCallback(
		(boostId: ShopBoostId) =>
			performAwaitedAction({ endpoint: "activate-boost", boostId }),
		[performAwaitedAction],
	);

	const resetShopBoosts = useCallback(
		() => performAwaitedAction({ endpoint: "reset-shop-boosts" }),
		[performAwaitedAction],
	);

	const resetResearch = useCallback(
		() => performAwaitedAction({ endpoint: "reset-research" }),
		[performAwaitedAction],
	);

	const assignLabResearch = useCallback(
		({ labId, researchId }: { labId: LabId; researchId: ResearchId }) =>
			performAwaitedAction({ endpoint: "assign-research", labId, researchId }),
		[performAwaitedAction],
	);

	const unassignLabResearch = useCallback(
		(labId: LabId) =>
			performAwaitedAction({ endpoint: "unassign-research", labId }),
		[performAwaitedAction],
	);

	const unlockLab = useCallback(
		(labId: LabId) => performAwaitedAction({ endpoint: "unlock-lab", labId }),
		[performAwaitedAction],
	);

	const buyCouponUpgrade = useCallback(
		(upgradeId: CouponUpgradeId) =>
			performAwaitedAction({ endpoint: "buy-coupon-upgrade", upgradeId }),
		[performAwaitedAction],
	);

	const prestige = useCallback(
		() => performAwaitedAction({ endpoint: "prestige", fullReplace: true }),
		[performAwaitedAction],
	);

	const devBoost = useCallback(
		() => performAwaitedAction({ endpoint: "dev-boost", fullReplace: true }),
		[performAwaitedAction],
	);

	const timeWarp = useCallback(
		async (durationSeconds: number): Promise<boolean> => {
			try {
				const result = await executeTimeWarp(durationSeconds);
				reconcileState({ state: result.state, fullReplace: false });
				setOfflineSummary(deserializeOfflineSummary(result.offlineSummary));
				return true;
			} catch {
				return false;
			}
		},
		[executeTimeWarp, reconcileState],
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
		buyCouponUpgrade,
		timeWarp,
		resetGame,
		prestige,
		devBoost,
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
