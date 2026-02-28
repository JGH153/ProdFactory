import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { getEffectiveRunTime, getRunTimeMultiplier } from "@/game/logic";
import { getPrestigePassiveMultiplier } from "@/game/prestige-config";
import {
	getResearchMultiplier,
	getResearchTime,
	getResearchTimeMultiplier,
	getSpeedResearchMultiplier,
	LAB_ORDER,
	MAX_RESEARCH_LEVEL,
} from "@/game/research-config";
import type {
	SerializedGameState,
	SerializedLabState,
	SerializedResourceState,
} from "@/game/state/serialization";
import type { LabId, ResearchId, ResourceId } from "@/game/types";
import type { SerializedBigNum } from "@/lib/big-number";
import {
	type BigNum,
	bigNum,
	bnAdd,
	bnDeserialize,
	bnGte,
	bnMul,
	bnSerialize,
	bnToNumber,
} from "@/lib/big-number";

const MAX_OFFLINE_SECONDS = 8 * 3600;
const MIN_OFFLINE_SECONDS = 10;

export type SerializedOfflineSummary = {
	elapsedSeconds: number;
	gains: { resourceId: ResourceId; amount: SerializedBigNum }[];
	researchLevelUps: { researchId: ResearchId; newLevel: number }[];
	wasCapped: boolean;
};

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
	const prestigeMul = state.prestige?.lifetimeCoupons
		? getPrestigePassiveMultiplier({
				lifetimeCoupons: bnDeserialize(state.prestige.lifetimeCoupons),
			})
		: 1;

	// Advance research before computing resource production
	const initialResearch = state.research ?? createInitialGameState().research;
	const research = { ...initialResearch } as Record<ResearchId, number>;
	const initialLabs = state.labs ?? createInitialGameState().labs;
	const updatedLabs = { ...initialLabs } as Record<LabId, SerializedLabState>;

	const researchLevelUps: SerializedOfflineSummary["researchLevelUps"] = [];
	const rtm = getResearchTimeMultiplier({ shopBoosts });

	for (const labId of LAB_ORDER) {
		const lab = updatedLabs[labId];
		if (
			!lab.isUnlocked ||
			lab.activeResearchId === null ||
			lab.researchStartedAt === null
		) {
			continue;
		}

		const researchId = lab.activeResearchId;
		let currentLevel = research[researchId];
		let elapsedMs = serverNow - lab.researchStartedAt;
		let advanced = false;

		while (currentLevel < MAX_RESEARCH_LEVEL) {
			const levelTimeMs = getResearchTime(currentLevel) * 1000 * rtm;
			if (elapsedMs < levelTimeMs) {
				break;
			}
			elapsedMs -= levelTimeMs;
			currentLevel++;
			advanced = true;
			researchLevelUps.push({ researchId, newLevel: currentLevel });
		}

		if (advanced) {
			research[researchId] = currentLevel;
			if (currentLevel >= MAX_RESEARCH_LEVEL) {
				updatedLabs[labId] = {
					...lab,
					activeResearchId: null,
					researchStartedAt: null,
				};
			} else {
				updatedLabs[labId] = {
					...lab,
					researchStartedAt: serverNow - elapsedMs,
				};
			}
		}
	}

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

		const rtm = getRunTimeMultiplier({
			shopBoosts,
			isAutomated: true,
			speedResearchMultiplier: getSpeedResearchMultiplier({
				research,
				resourceId,
			}),
		});
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

		const researchMul = getResearchMultiplier({ research, resourceId });
		const gain = bigNum(
			actualRuns *
				resource.producers *
				productionMul *
				researchMul *
				prestigeMul,
		);
		netAvailable[resourceId] = bnAdd(savedAmount, gain);
		gains.push({ resourceId, amount: bnSerialize(gain) });
		updatedResources[resourceId] = {
			...resource,
			amount: bnSerialize(bnAdd(savedAmount, gain)),
		};
	}

	if (gains.length === 0 && researchLevelUps.length === 0) {
		return { updatedState: state, summary: null };
	}

	// Track Nuclear Pasta offline production in prestige state
	const npGain = gains.find((g) => g.resourceId === "nuclear-pasta");
	const updatedPrestige =
		npGain && state.prestige
			? {
					...state.prestige,
					nuclearPastaProducedThisRun: bnSerialize(
						bnAdd(
							bnDeserialize(state.prestige.nuclearPastaProducedThisRun),
							bnDeserialize(npGain.amount),
						),
					),
				}
			: state.prestige;

	return {
		updatedState: {
			...state,
			...(gains.length > 0 && { resources: updatedResources }),
			...(researchLevelUps.length > 0 && {
				labs: updatedLabs,
				research,
			}),
			...(updatedPrestige && { prestige: updatedPrestige }),
		},
		summary: { elapsedSeconds, gains, researchLevelUps, wasCapped },
	};
};
