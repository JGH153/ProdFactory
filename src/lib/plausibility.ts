import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "@/game/config";
import { getEffectiveRunTime } from "@/game/logic";
import type {
	SerializedGameState,
	SerializedResourceState,
} from "@/game/serialization";
import type { ResourceId } from "@/game/types";
import {
	type BigNum,
	bigNum,
	bnAdd,
	bnDeserialize,
	bnGte,
	bnIsZero,
	bnMul,
	bnSerialize,
	bnSub,
} from "@/lib/big-number";
import type { SyncSnapshot } from "@/lib/redis";

const PLAUSIBILITY_TOLERANCE = 1.1;

type PlausibilityResult = {
	corrected: boolean;
	correctedState: SerializedGameState | null;
	warnings: string[];
};

export const checkPlausibility = (
	claimedState: SerializedGameState,
	lastSnapshot: SyncSnapshot,
	serverNow: number,
): PlausibilityResult => {
	const elapsed = serverNow - lastSnapshot.timestamp;

	if (elapsed <= 0) {
		return { corrected: false, correctedState: null, warnings: [] };
	}

	let corrected = false;
	const warnings: string[] = [];
	const correctedResources = { ...claimedState.resources } as Record<
		ResourceId,
		SerializedResourceState
	>;

	for (const resourceId of RESOURCE_ORDER) {
		const snapshotResource = lastSnapshot.resources[resourceId];
		const claimedResource = claimedState.resources[resourceId];
		const config = RESOURCE_CONFIGS[resourceId];

		if (!snapshotResource || !claimedResource) {
			continue;
		}

		const snapshotAmount = bnDeserialize(snapshotResource.amount);
		const claimedAmount = bnDeserialize(claimedResource.amount);

		const actualGain = bnSub(claimedAmount, snapshotAmount);

		if (bnIsZero(actualGain)) {
			continue;
		}

		// If claimed is less than snapshot, resource was spent — always valid
		if (!bnGte(claimedAmount, snapshotAmount)) {
			continue;
		}

		let maxProduction: BigNum;

		if (!claimedResource.isUnlocked || (claimedResource.isPaused ?? false)) {
			maxProduction = bigNum(0);
		} else {
			const runTimeMs =
				getEffectiveRunTime(resourceId, snapshotResource.producers) * 1000;
			const maxRuns = Math.floor(elapsed / runTimeMs);
			const producers = snapshotResource.producers;
			maxProduction = bigNum(maxRuns * producers);
		}

		if (bnIsZero(maxProduction) && !bnIsZero(actualGain)) {
			// Gained resources when none should be possible
			correctedResources[resourceId] = {
				...claimedResource,
				amount: bnSerialize(snapshotAmount),
			};
			corrected = true;
			warnings.push(`${config.name} production exceeded plausible rate`);
			continue;
		}

		const tolerance = bnMul(maxProduction, bigNum(PLAUSIBILITY_TOLERANCE));

		if (!bnGte(tolerance, actualGain)) {
			const correctedAmount = bnAdd(snapshotAmount, maxProduction);
			correctedResources[resourceId] = {
				...claimedResource,
				amount: bnSerialize(correctedAmount),
			};
			corrected = true;
			warnings.push(`${config.name} production exceeded plausible rate`);
		}
	}

	if (corrected) {
		return {
			corrected: true,
			correctedState: {
				...claimedState,
				resources: correctedResources,
			},
			warnings,
		};
	}

	return { corrected: false, correctedState: null, warnings: [] };
};

export const buildSyncSnapshot = (
	state: SerializedGameState,
	timestamp: number,
): SyncSnapshot => {
	const resources = {} as SyncSnapshot["resources"];
	for (const resourceId of RESOURCE_ORDER) {
		const resource = state.resources[resourceId];
		if (resource) {
			resources[resourceId] = {
				amount: resource.amount,
				producers: resource.producers,
			};
		}
	}
	return { timestamp, resources };
};
