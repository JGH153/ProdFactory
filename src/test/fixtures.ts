import { createInitialGameState } from "@/game/initial-state";
import {
	type SerializedGameState,
	serializeGameState,
} from "@/game/state/serialization";
import type { LabId, ResearchId, ResourceId } from "@/game/types";

export const createInitialSerializedState = (): SerializedGameState =>
	serializeGameState(createInitialGameState());

type StateOverrides = {
	resources?: Partial<
		Record<ResourceId, Partial<SerializedGameState["resources"][ResourceId]>>
	>;
	shopBoosts?: Partial<SerializedGameState["shopBoosts"]>;
	labs?: Partial<
		Record<LabId, Partial<NonNullable<SerializedGameState["labs"]>[LabId]>>
	>;
	research?: Partial<Record<ResearchId, number>>;
};

export const createStateWith = (
	overrides: StateOverrides,
): SerializedGameState => {
	const base = createInitialSerializedState();
	if (overrides.resources) {
		for (const [id, changes] of Object.entries(overrides.resources)) {
			const resourceId = id as ResourceId;
			base.resources[resourceId] = {
				...base.resources[resourceId],
				...changes,
			};
		}
	}
	if (overrides.shopBoosts && base.shopBoosts) {
		Object.assign(base.shopBoosts, overrides.shopBoosts);
	}
	if (overrides.labs) {
		for (const [id, changes] of Object.entries(overrides.labs)) {
			const labId = id as LabId;
			if (base.labs) {
				base.labs[labId] = { ...base.labs[labId], ...changes };
			}
		}
	}
	if (overrides.research && base.research) {
		Object.assign(base.research, overrides.research);
	}
	return base;
};
