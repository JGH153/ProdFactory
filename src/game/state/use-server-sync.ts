"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { type RefObject, useCallback, useEffect, useRef } from "react";
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
	resetGame as apiResetGame,
	saveGame as apiSaveGame,
	syncGame as apiSyncGame,
	ConflictError,
} from "@/lib/api-client";
import type { SerializedGameState } from "./serialization";
import { deserializeOfflineSummary, serializeGameState } from "./serialization";

const AUTO_SAVE_INTERVAL_MS = 5_000;
const AUTO_SYNC_INTERVAL_MS = 15_000;

type QueueItem = {
	endpoint: string;
	resourceId?: ResourceId | undefined;
	boostId?: ShopBoostId | undefined;
	labId?: LabId | undefined;
	researchId?: ResearchId | undefined;
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
	}) => void;
	executeAwaitedAction: (args: {
		endpoint: string;
		resourceId?: ResourceId | undefined;
		boostId?: ShopBoostId | undefined;
		labId?: LabId | undefined;
		researchId?: ResearchId | undefined;
	}) => Promise<SerializedGameState>;
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

	const { mutateAsync: executeReset } = useMutation({
		mutationKey: ["game", "reset"],
		mutationFn: ({ serverVersion }: { serverVersion: number }) =>
			apiResetGame(serverVersion),
	});

	const processQueue = useCallback(async () => {
		if (processingRef.current || !isReadyRef.current) {
			return;
		}

		if (inFlightSaveRef.current) {
			await inFlightSaveRef.current;
		}

		processingRef.current = true;

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
	}, [executeAction, reconcileState]);

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
			const savePromise = executeSave({
				state: serialized,
				serverVersion: serverVersionRef.current,
			})
				.then((result) => {
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

	const executeAwaitedAction = useCallback(
		async ({
			endpoint,
			resourceId,
			boostId,
			labId,
			researchId,
		}: {
			endpoint: string;
			resourceId?: ResourceId | undefined;
			boostId?: ShopBoostId | undefined;
			labId?: LabId | undefined;
			researchId?: ResearchId | undefined;
		}): Promise<SerializedGameState> => {
			// Wait for initial server data to be reconciled
			while (!isReadyRef.current) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			// Wait for queue to drain
			while (processingRef.current || queueRef.current.length > 0) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}

			// Wait for any in-flight save/sync
			if (inFlightSaveRef.current) {
				await inFlightSaveRef.current;
			}

			// Block queue and save/sync from running
			processingRef.current = true;

			try {
				// Flush current client state so the server has latest run-accumulated resources
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

				const result = await executeAction({
					endpoint,
					resourceId,
					boostId,
					labId,
					researchId,
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
		[executeAction, executeSave, stateRef],
	);

	const enqueueAction = useCallback(
		({
			endpoint,
			resourceId,
			boostId,
			labId,
			researchId,
		}: {
			endpoint: string;
			resourceId?: ResourceId | undefined;
			boostId?: ShopBoostId | undefined;
			labId?: LabId | undefined;
			researchId?: ResearchId | undefined;
		}) => {
			queueRef.current.push({
				endpoint,
				resourceId,
				boostId,
				labId,
				researchId,
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

	return { enqueueAction, executeAwaitedAction, resetOnServer };
};
