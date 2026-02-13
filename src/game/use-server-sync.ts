"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import type { SerializedGameState } from "@/game/serialization";
import { serializeGameState } from "@/game/serialization";
import type { GameState, ResourceId } from "@/game/types";
import {
	loadGame as apiLoadGame,
	postAction as apiPostAction,
	resetGame as apiResetGame,
	saveGame as apiSaveGame,
	syncGame as apiSyncGame,
	ConflictError,
} from "@/lib/api-client";

const AUTO_SAVE_INTERVAL_MS = 5_000;
const AUTO_SYNC_INTERVAL_MS = 15_000;

type QueueItem = {
	endpoint: string;
	resourceId: ResourceId;
};

type ReconcileCallback = (
	state: SerializedGameState,
	fullReplace: boolean,
) => void;

export const useServerSync = (
	stateRef: RefObject<GameState>,
	reconcileState: ReconcileCallback,
): {
	enqueueAction: (endpoint: string, resourceId: ResourceId) => void;
	resetOnServer: () => void;
} => {
	const serverVersionRef = useRef(0);
	const isReadyRef = useRef(false);
	const queueRef = useRef<QueueItem[]>([]);
	const processingRef = useRef(false);

	// --- TanStack Query: initial load ---

	const { data: initialData } = useQuery({
		queryKey: ["game", "load"],
		queryFn: () => apiLoadGame(),
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

	// --- TanStack Query: mutations ---

	const { mutateAsync: executeSave } = useMutation({
		mutationKey: ["game", "save"],
		mutationFn: ({
			state,
			serverVersion,
		}: {
			state: SerializedGameState;
			serverVersion: number;
		}) => apiSaveGame(state, serverVersion),
	});

	const { mutateAsync: executeSync } = useMutation({
		mutationKey: ["game", "sync"],
		mutationFn: ({
			state,
			serverVersion,
		}: {
			state: SerializedGameState;
			serverVersion: number;
		}) => apiSyncGame(state, serverVersion),
	});

	const { mutateAsync: executeAction } = useMutation({
		mutationKey: ["game", "action"],
		mutationFn: ({
			endpoint,
			resourceId,
			serverVersion,
		}: {
			endpoint: string;
			resourceId: ResourceId;
			serverVersion: number;
		}) => apiPostAction(endpoint, resourceId, serverVersion),
	});

	const { mutateAsync: executeReset } = useMutation({
		mutationKey: ["game", "reset"],
		mutationFn: ({ serverVersion }: { serverVersion: number }) =>
			apiResetGame(serverVersion),
	});

	// --- Queue processing ---

	const processQueue = useCallback(async () => {
		if (processingRef.current || !isReadyRef.current) {
			return;
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
					serverVersion: serverVersionRef.current,
				});
				serverVersionRef.current = result.serverVersion;
				reconcileState(result.state, false);
				queueRef.current.shift();
			} catch (error) {
				if (error instanceof ConflictError) {
					serverVersionRef.current = error.serverVersion;
					reconcileState(error.state, false);
				}
				// On any error (conflict, action failed, network), clear remaining queue
				queueRef.current = [];
				break;
			}
		}

		processingRef.current = false;
	}, [executeAction, reconcileState]);

	// --- Initial load handling ---

	useEffect(() => {
		if (initialData === undefined || isReadyRef.current) {
			return;
		}

		if (initialData !== null) {
			// Server has state — adopt it
			serverVersionRef.current = initialData.serverVersion;
			isReadyRef.current = true;
			reconcileState(initialData.state, false);
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
	}, [initialData, reconcileState, executeSave, stateRef]);

	// --- Auto-save interval (5s) ---

	useEffect(() => {
		const interval = setInterval(() => {
			if (
				!isReadyRef.current ||
				queueRef.current.length > 0 ||
				processingRef.current
			) {
				return;
			}

			const serialized = serializeGameState(stateRef.current);
			executeSave({
				state: serialized,
				serverVersion: serverVersionRef.current,
			})
				.then((result) => {
					serverVersionRef.current = result.serverVersion;
				})
				.catch((error) => {
					if (error instanceof ConflictError) {
						serverVersionRef.current = error.serverVersion;
						reconcileState(error.state, false);
					}
					// Network errors silently ignored — next interval will retry
				});
		}, AUTO_SAVE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [executeSave, reconcileState, stateRef]);

	// --- Auto-sync interval (15s) ---

	useEffect(() => {
		const interval = setInterval(() => {
			if (
				!isReadyRef.current ||
				queueRef.current.length > 0 ||
				processingRef.current
			) {
				return;
			}

			const serialized = serializeGameState(stateRef.current);
			executeSync({
				state: serialized,
				serverVersion: serverVersionRef.current,
			})
				.then((result) => {
					serverVersionRef.current = result.serverVersion;
					if (result.state !== null) {
						reconcileState(result.state, false);
					}
				})
				.catch((error) => {
					if (error instanceof ConflictError) {
						serverVersionRef.current = error.serverVersion;
						reconcileState(error.state, false);
					}
				});
		}, AUTO_SYNC_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [executeSync, reconcileState, stateRef]);

	// --- Exported methods ---

	const enqueueAction = useCallback(
		(endpoint: string, resourceId: ResourceId) => {
			queueRef.current.push({ endpoint, resourceId });
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
				reconcileState(result.state, true);
			})
			.catch((error) => {
				if (error instanceof ConflictError) {
					serverVersionRef.current = error.serverVersion;
					reconcileState(error.state, true);
				}
			});
	}, [executeReset, reconcileState]);

	return { enqueueAction, resetOnServer };
};
