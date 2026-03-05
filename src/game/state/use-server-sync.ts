"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { CouponUpgradeId } from "@/game/coupon-shop-config";
import type {
	GameState,
	LabId,
	OfflineSummary,
	ResearchId,
	ResourceId,
	ShopBoostId,
} from "@/game/types";
import {
	loadGame as apiLoadGame,
	postAction as apiPostAction,
	postTimeWarp as apiPostTimeWarp,
	resetGame as apiResetGame,
	saveGame as apiSaveGame,
	syncGame as apiSyncGame,
	ConflictError,
} from "@/lib/api-client";
import { BUILD_ID } from "@/lib/env-frontend";
import type { SerializedOfflineSummary } from "@/lib/server/offline-progress";
import { saveGame as saveToLocalStorage } from "./persistence";
import type { SerializedGameState } from "./serialization";
import { deserializeOfflineSummary, serializeGameState } from "./serialization";
import { useFlushOnExit } from "./use-flush-on-exit";

const AUTO_SAVE_INTERVAL_MS = 10_000;
const AUTO_SYNC_INTERVAL_MS = 30_000;

const isStaleDeployment = (responseBuildId: string | undefined): boolean => {
	if (!BUILD_ID || !responseBuildId) {
		return false;
	}
	return BUILD_ID !== responseBuildId;
};

type QueueItem = {
	endpoint: string;
	resourceId?: ResourceId | undefined;
	boostId?: ShopBoostId | undefined;
	labId?: LabId | undefined;
	researchId?: ResearchId | undefined;
	upgradeId?: CouponUpgradeId | undefined;
};

type ReconcileCallback = (args: {
	state: SerializedGameState;
	fullReplace: boolean;
}) => void;

export const useServerSync = ({
	stateRef,
	reconcileState,
	onOfflineSummary,
}: {
	stateRef: RefObject<GameState>;
	reconcileState: ReconcileCallback;
	onOfflineSummary: (summary: OfflineSummary) => void;
}): {
	enqueueAction: (args: {
		endpoint: string;
		resourceId?: ResourceId | undefined;
		boostId?: ShopBoostId | undefined;
		labId?: LabId | undefined;
		researchId?: ResearchId | undefined;
		upgradeId?: CouponUpgradeId | undefined;
	}) => void;
	executeAwaitedAction: (args: {
		endpoint: string;
		resourceId?: ResourceId | undefined;
		boostId?: ShopBoostId | undefined;
		labId?: LabId | undefined;
		researchId?: ResearchId | undefined;
		upgradeId?: CouponUpgradeId | undefined;
	}) => Promise<SerializedGameState>;
	executeTimeWarp: () => Promise<{
		state: SerializedGameState;
		offlineSummary: SerializedOfflineSummary;
	}>;
	resetOnServer: () => void;
} => {
	const serverVersionRef = useRef(0);
	const isReadyRef = useRef(false);
	const queueRef = useRef<QueueItem[]>([]);
	const processingRef = useRef(false);
	const inFlightSaveRef = useRef<Promise<unknown> | null>(null);

	const { data: initialData } = useQuery({
		queryKey: ["game", "load"],
		queryFn: () => apiLoadGame(),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

	const { mutateAsync: executeSave } = useMutation({
		mutationKey: ["game", "save"],
		mutationFn: apiSaveGame,
	});

	const { mutateAsync: executeSync } = useMutation({
		mutationKey: ["game", "sync"],
		mutationFn: apiSyncGame,
	});

	const { mutateAsync: executeAction } = useMutation({
		mutationKey: ["game", "action"],
		mutationFn: apiPostAction,
	});

	const { mutateAsync: executeTimeWarpMutation } = useMutation({
		mutationKey: ["game", "time-warp"],
		mutationFn: apiPostTimeWarp,
	});

	const { mutateAsync: executeReset } = useMutation({
		mutationKey: ["game", "reset"],
		mutationFn: ({ serverVersion }: { serverVersion: number }) =>
			apiResetGame(serverVersion),
	});

	const processQueue = useCallback(async () => {
		if (processingRef.current || !isReadyRef.current) {
			return;
		}
		if (queueRef.current.length === 0) {
			return;
		}

		// Capture BEFORE any await — reflects production gains, not the optimistic buy
		const stateForFlush = serializeGameState(stateRef.current);

		if (inFlightSaveRef.current) {
			await inFlightSaveRef.current;
		}

		processingRef.current = true;

		// Pre-flush: sync production gains to server before running mutations
		try {
			const preFlushResult = await executeSave({
				state: stateForFlush,
				serverVersion: serverVersionRef.current,
			});
			if (isStaleDeployment(preFlushResult.buildId)) {
				window.location.reload();
				return;
			}
			serverVersionRef.current = preFlushResult.serverVersion;
			if (preFlushResult.state != null) {
				reconcileState({ state: preFlushResult.state, fullReplace: false });
			}
		} catch (preFlushError) {
			if (preFlushError instanceof ConflictError) {
				serverVersionRef.current = preFlushError.serverVersion;
			} else {
				queueRef.current = [];
				processingRef.current = false;
				return;
			}
		}

		while (queueRef.current.length > 0) {
			const item = queueRef.current[0];
			if (!item) {
				break;
			}
			try {
				const result = await executeAction({
					endpoint: item.endpoint,
					resourceId: item.resourceId,
					boostId: item.boostId,
					labId: item.labId,
					researchId: item.researchId,
					upgradeId: item.upgradeId,
					serverVersion: serverVersionRef.current,
				});
				serverVersionRef.current = result.serverVersion;
				queueRef.current.shift();
			} catch (error) {
				if (error instanceof ConflictError) {
					// Adopt the server's version and retry the same action once
					serverVersionRef.current = error.serverVersion;
					try {
						const retryResult = await executeAction({
							endpoint: item.endpoint,
							resourceId: item.resourceId,
							boostId: item.boostId,
							labId: item.labId,
							researchId: item.researchId,
							upgradeId: item.upgradeId,
							serverVersion: serverVersionRef.current,
						});
						serverVersionRef.current = retryResult.serverVersion;
						reconcileState({ state: retryResult.state, fullReplace: false });
						queueRef.current.shift();
						continue;
					} catch {
						// Retry failed — roll back optimistic update with the 409 state
						reconcileState({ state: error.state, fullReplace: false });
					}
				}
				queueRef.current = [];
				break;
			}
		}

		processingRef.current = false;
	}, [executeAction, executeSave, reconcileState, stateRef]);

	useEffect(() => {
		if (initialData === undefined || isReadyRef.current) {
			return;
		}

		if (initialData !== null) {
			// Server has state — adopt it
			serverVersionRef.current = initialData.serverVersion;
			isReadyRef.current = true;
			reconcileState({ state: initialData.state, fullReplace: false });
			if (initialData.offlineSummary) {
				onOfflineSummary(deserializeOfflineSummary(initialData.offlineSummary));
			}
		} else {
			// No server state (404) — migrate localStorage state to server
			const serialized = serializeGameState(stateRef.current);
			executeSave({ state: serialized, serverVersion: 0 })
				.then((result) => {
					serverVersionRef.current = result.serverVersion;
					isReadyRef.current = true;
				})
				.catch(() => {
					// Migration failed — game continues client-side only
					// Next interval will retry
				});
		}
	}, [initialData, reconcileState, executeSave, stateRef, onOfflineSummary]);

	useEffect(() => {
		const interval = setInterval(() => {
			if (
				!isReadyRef.current ||
				queueRef.current.length > 0 ||
				processingRef.current ||
				inFlightSaveRef.current
			) {
				return;
			}

			const serialized = serializeGameState(stateRef.current);
			saveToLocalStorage(stateRef.current);
			const savePromise = executeSave({
				state: serialized,
				serverVersion: serverVersionRef.current,
			})
				.then((result) => {
					if (isStaleDeployment(result.buildId)) {
						window.location.reload();
						return;
					}
					if (queueRef.current.length === 0 && !processingRef.current) {
						serverVersionRef.current = result.serverVersion;
						if (result.state) {
							reconcileState({ state: result.state, fullReplace: false });
						}
					}
				})
				.catch((error) => {
					if (error instanceof ConflictError) {
						if (queueRef.current.length === 0 && !processingRef.current) {
							serverVersionRef.current = error.serverVersion;
							reconcileState({ state: error.state, fullReplace: false });
						}
					}
					// Network errors silently ignored — next interval will retry
				})
				.finally(() => {
					inFlightSaveRef.current = null;
				});

			inFlightSaveRef.current = savePromise;
		}, AUTO_SAVE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [executeSave, reconcileState, stateRef]);

	useFlushOnExit({ stateRef, serverVersionRef, isReadyRef });

	useEffect(() => {
		const interval = setInterval(() => {
			if (
				!isReadyRef.current ||
				queueRef.current.length > 0 ||
				processingRef.current ||
				inFlightSaveRef.current
			) {
				return;
			}

			const serialized = serializeGameState(stateRef.current);
			const syncPromise = executeSync({
				state: serialized,
				serverVersion: serverVersionRef.current,
			})
				.then((result) => {
					if (isStaleDeployment(result.buildId)) {
						window.location.reload();
						return;
					}
					if (queueRef.current.length === 0 && !processingRef.current) {
						serverVersionRef.current = result.serverVersion;
						if (result.state !== null) {
							reconcileState({ state: result.state, fullReplace: false });
						}
					}
				})
				.catch((error) => {
					if (error instanceof ConflictError) {
						if (queueRef.current.length === 0 && !processingRef.current) {
							serverVersionRef.current = error.serverVersion;
							reconcileState({ state: error.state, fullReplace: false });
						}
					}
				})
				.finally(() => {
					inFlightSaveRef.current = null;
				});

			inFlightSaveRef.current = syncPromise;
		}, AUTO_SYNC_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [executeSync, reconcileState, stateRef]);

	// Shared helper: wait for ready, drain queue, flush client state to server,
	// then hold the processing lock. Caller MUST release in a finally block.
	const acquireExclusiveLock = useCallback(async () => {
		while (!isReadyRef.current) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		while (processingRef.current || queueRef.current.length > 0) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		if (inFlightSaveRef.current) {
			await inFlightSaveRef.current;
		}

		processingRef.current = true;

		const serialized = serializeGameState(stateRef.current);
		try {
			const saveResult = await executeSave({
				state: serialized,
				serverVersion: serverVersionRef.current,
			});
			serverVersionRef.current = saveResult.serverVersion;
		} catch (saveError) {
			if (saveError instanceof ConflictError) {
				serverVersionRef.current = saveError.serverVersion;
				const retrySave = await executeSave({
					state: serialized,
					serverVersion: serverVersionRef.current,
				});
				serverVersionRef.current = retrySave.serverVersion;
			} else {
				throw saveError;
			}
		}
	}, [executeSave, stateRef]);

	const executeAwaitedAction = useCallback(
		async ({
			endpoint,
			resourceId,
			boostId,
			labId,
			researchId,
			upgradeId,
		}: {
			endpoint: string;
			resourceId?: ResourceId | undefined;
			boostId?: ShopBoostId | undefined;
			labId?: LabId | undefined;
			researchId?: ResearchId | undefined;
			upgradeId?: CouponUpgradeId | undefined;
		}): Promise<SerializedGameState> => {
			await acquireExclusiveLock();
			try {
				const result = await executeAction({
					endpoint,
					resourceId,
					boostId,
					labId,
					researchId,
					upgradeId,
					serverVersion: serverVersionRef.current,
				});
				serverVersionRef.current = result.serverVersion;
				return result.state;
			} catch (error) {
				if (error instanceof ConflictError) {
					serverVersionRef.current = error.serverVersion;
					const retryResult = await executeAction({
						endpoint,
						resourceId,
						boostId,
						labId,
						researchId,
						upgradeId,
						serverVersion: serverVersionRef.current,
					});
					serverVersionRef.current = retryResult.serverVersion;
					return retryResult.state;
				}
				throw error;
			} finally {
				processingRef.current = false;
			}
		},
		[acquireExclusiveLock, executeAction],
	);

	const executeTimeWarp = useCallback(async (): Promise<{
		state: SerializedGameState;
		offlineSummary: SerializedOfflineSummary;
	}> => {
		await acquireExclusiveLock();
		try {
			const result = await executeTimeWarpMutation({
				serverVersion: serverVersionRef.current,
			});
			serverVersionRef.current = result.serverVersion;
			return { state: result.state, offlineSummary: result.offlineSummary };
		} catch (error) {
			if (error instanceof ConflictError) {
				serverVersionRef.current = error.serverVersion;
				const retryResult = await executeTimeWarpMutation({
					serverVersion: serverVersionRef.current,
				});
				serverVersionRef.current = retryResult.serverVersion;
				return {
					state: retryResult.state,
					offlineSummary: retryResult.offlineSummary,
				};
			}
			throw error;
		} finally {
			processingRef.current = false;
		}
	}, [acquireExclusiveLock, executeTimeWarpMutation]);

	const enqueueAction = useCallback(
		({
			endpoint,
			resourceId,
			boostId,
			labId,
			researchId,
			upgradeId,
		}: {
			endpoint: string;
			resourceId?: ResourceId | undefined;
			boostId?: ShopBoostId | undefined;
			labId?: LabId | undefined;
			researchId?: ResearchId | undefined;
			upgradeId?: CouponUpgradeId | undefined;
		}) => {
			queueRef.current.push({
				endpoint,
				resourceId,
				boostId,
				labId,
				researchId,
				upgradeId,
			});
			processQueue();
		},
		[processQueue],
	);

	const resetOnServer = useCallback(() => {
		// Clear any pending actions
		queueRef.current = [];
		processingRef.current = false;

		if (!isReadyRef.current) {
			return;
		}

		executeReset({ serverVersion: serverVersionRef.current })
			.then((result) => {
				serverVersionRef.current = result.serverVersion;
				reconcileState({ state: result.state, fullReplace: true });
			})
			.catch((error) => {
				if (error instanceof ConflictError) {
					serverVersionRef.current = error.serverVersion;
					reconcileState({ state: error.state, fullReplace: true });
				}
			});
	}, [executeReset, reconcileState]);

	return {
		enqueueAction,
		executeAwaitedAction,
		executeTimeWarp,
		resetOnServer,
	};
};
