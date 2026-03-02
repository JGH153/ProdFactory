"use client";

import { useCallback } from "react";
import type { SerializedGameState } from "@/game/state/serialization";
import type { LabId, ResearchId, ResourceId, ShopBoostId } from "@/game/types";

type ActionArgs = {
	endpoint: string;
	resourceId?: ResourceId | undefined;
	boostId?: ShopBoostId | undefined;
	labId?: LabId | undefined;
	researchId?: ResearchId | undefined;
};

type ExecuteAwaitedAction = (args: ActionArgs) => Promise<SerializedGameState>;

type ReconcileState = (args: {
	state: SerializedGameState;
	fullReplace: boolean;
}) => void;

/**
 * Returns a function that executes a server-awaited action with
 * automatic error handling and state reconciliation.
 */
export const useAwaitedAction = ({
	executeAwaitedAction,
	reconcileState,
}: {
	executeAwaitedAction: ExecuteAwaitedAction;
	reconcileState: ReconcileState;
}) => {
	return useCallback(
		async ({
			fullReplace = false,
			...actionArgs
		}: ActionArgs & { fullReplace?: boolean }): Promise<boolean> => {
			try {
				const serverState = await executeAwaitedAction(actionArgs);
				reconcileState({ state: serverState, fullReplace });
				return true;
			} catch {
				return false;
			}
		},
		[executeAwaitedAction, reconcileState],
	);
};
