import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { getEffectiveRunTime, getRunTimeMultiplier } from "@/game/logic";
import type {
	SerializedGameState,
	SerializedResourceState,
} from "@/game/serialization";
import type { ResourceId } from "@/game/types";
import type { SerializedBigNum } from "@/lib/big-number";
import {
	type BigNum,
	bigNum,
	bnAdd,
	bnDeserialize,
	bnGte,
	bnMul,
	bnSerialize,
} from "@/lib/big-number";

const MAX_OFFLINE_SECONDS = 8 * 3600;
const MIN_OFFLINE_SECONDS = 10;

export type SerializedOfflineSummary = {
	elapsedSeconds: number;
	gains: { resourceId: ResourceId; amount: SerializedBigNum }[];
	wasCapped: boolean;
};

const bnToNumber = (bn: BigNum): number => bn.mantissa * 10 ** bn.exponent;

export const computeOfflineProgress = ({
	state,
	serverNow,
}: {
	state: SerializedGameState;
	serverNow: number;
}): {
	updatedState: SerializedGameState;
	summary: SerializedOfflineSummary | null;
} => {
	if (!state.lastSavedAt) {
		return { updatedState: state, summary: null };
	}

	const rawElapsedSeconds = (serverNow - state.lastSavedAt) / 1000;
	const wasCapped = rawElapsedSeconds > MAX_OFFLINE_SECONDS;
	const elapsedSeconds = Math.min(rawElapsedSeconds, MAX_OFFLINE_SECONDS);

	if (elapsedSeconds < MIN_OFFLINE_SECONDS) {
		return { updatedState: state, summary: null };
	}

	const defaultBoosts = createInitialGameState().shopBoosts;
	const shopBoosts = state.shopBoosts ?? defaultBoosts;
	const productionMul = shopBoosts["production-20x"] ? 20 : 1;

	// netAvailable tracks savedAmount + offlineGain for each tier (used to cap next tier's input)
	const netAvailable = {} as Record<ResourceId, BigNum>;
	const updatedResources = { ...state.resources } as Record<
		ResourceId,
		SerializedResourceState
	>;
	const gains: SerializedOfflineSummary["gains"] = [];

	for (const resourceId of RESOURCE_ORDER) {
		const resource = state.resources[resourceId];
		const config = RESOURCE_CONFIGS[resourceId];
		const savedAmount = bnDeserialize(resource.amount);

		if (
			!resource.isUnlocked ||
			!resource.isAutomated ||
			(resource.isPaused ?? false)
		) {
			netAvailable[resourceId] = savedAmount;
			continue;
		}

		const rtm = getRunTimeMultiplier({ shopBoosts, isAutomated: true });
		const runTime = getEffectiveRunTime({
			resourceId,
			producers: resource.producers,
			runTimeMultiplier: rtm,
		});

		const maxRunsByTime = Math.floor(elapsedSeconds / runTime);

		if (maxRunsByTime === 0) {
			netAvailable[resourceId] = savedAmount;
			continue;
		}

		let actualRuns = maxRunsByTime;

		if (config.inputResourceId !== null && config.inputCostPerRun !== null) {
			const availableInput = netAvailable[config.inputResourceId];
			const inputNeededForMaxTime = bnMul(
				config.inputCostPerRun,
				bigNum(maxRunsByTime),
			);

			if (!bnGte(availableInput, inputNeededForMaxTime)) {
				// Input-bound: availableInput < inputCostPerRun * maxRunsByTime
				// At this point availableInput is a small number — safe to use JS arithmetic
				const inputNum = bnToNumber(availableInput);
				const costNum = bnToNumber(config.inputCostPerRun);
				actualRuns = Math.floor(inputNum / costNum);
			}
		}

		if (actualRuns === 0) {
			netAvailable[resourceId] = savedAmount;
			continue;
		}

		const gain = bigNum(actualRuns * resource.producers * productionMul);
		netAvailable[resourceId] = bnAdd(savedAmount, gain);
		gains.push({ resourceId, amount: bnSerialize(gain) });
		updatedResources[resourceId] = {
			...resource,
			amount: bnSerialize(bnAdd(savedAmount, gain)),
		};
	}

	if (gains.length === 0) {
		return { updatedState: state, summary: null };
	}

	return {
		updatedState: { ...state, resources: updatedResources },
		summary: { elapsedSeconds, gains, wasCapped },
	};
};
