import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "@/game/config";
import { getPrestigePassiveMultiplier } from "@/game/prestige-config";
import { getProductionForRuns } from "@/game/production";
import { advanceResearchLevels } from "@/game/research-calculator";
import {
	getMaxLevelForResearch,
	getOfflineCapSeconds,
	getResearchMultiplier,
	getResearchTimeMultiplier,
	getSpeedResearchMultiplier,
	LAB_ORDER,
} from "@/game/research-config";
import { getEffectiveRunTime, getRunTimeMultiplier } from "@/game/run-timing";
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

const MIN_OFFLINE_SECONDS = 10;

export type SerializedOfflineSummary = {
	elapsedSeconds: number;
	gains: { resourceId: ResourceId; amount: SerializedBigNum }[];
	researchLevelUps: { researchId: ResearchId; newLevel: number }[];
	wasCapped: boolean;
	isTimeWarp: boolean;
};

export const computeOfflineProgress = ({
	state,
	serverNow,
	skipOfflineCap = false,
}: {
	state: SerializedGameState;
	serverNow: number;
	skipOfflineCap?: boolean;
}): {
	updatedState: SerializedGameState;
	summary: SerializedOfflineSummary | null;
} => {
	if (!state.lastSavedAt) {
		return { updatedState: state, summary: null };
	}

	const shopBoosts = state.shopBoosts;
	const initialResearch = state.research;
	const maxOfflineSeconds = getOfflineCapSeconds({
		shopBoosts,
		research: initialResearch as Record<ResearchId, number>,
		offlineCapacityLevel: state.couponUpgrades?.["offline-capacity"] ?? 0,
	});

	const rawElapsedSeconds = (serverNow - state.lastSavedAt) / 1000;
	const wasCapped = !skipOfflineCap && rawElapsedSeconds > maxOfflineSeconds;
	const elapsedSeconds = skipOfflineCap
		? rawElapsedSeconds
		: Math.min(rawElapsedSeconds, maxOfflineSeconds);

	if (elapsedSeconds < MIN_OFFLINE_SECONDS) {
		return { updatedState: state, summary: null };
	}

	const productionMul = shopBoosts["production-2x"] ? 2 : 1;
	const prestigeMul = getPrestigePassiveMultiplier({
		lifetimeCoupons: bnDeserialize(state.prestige.lifetimeCoupons),
	});

	// Advance research before computing resource production
	const research = { ...initialResearch } as Record<ResearchId, number>;
	const updatedLabs = { ...state.labs } as Record<LabId, SerializedLabState>;

	const researchLevelUps: SerializedOfflineSummary["researchLevelUps"] = [];
	const researchTimeMultiplier = getResearchTimeMultiplier({ shopBoosts });

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
		const startLevel = research[researchId];
		const maxLevel = getMaxLevelForResearch(researchId);
		const { newLevel, remainingMs } = advanceResearchLevels({
			startLevel,
			elapsedMs: serverNow - lab.researchStartedAt,
			researchTimeMultiplier,
			maxLevel,
		});

		if (newLevel > startLevel) {
			for (let lvl = startLevel + 1; lvl <= newLevel; lvl++) {
				researchLevelUps.push({ researchId, newLevel: lvl });
			}
			research[researchId] = newLevel;
			if (newLevel >= maxLevel) {
				updatedLabs[labId] = {
					...lab,
					activeResearchId: null,
					researchStartedAt: null,
				};
			} else {
				updatedLabs[labId] = {
					...lab,
					researchStartedAt: serverNow - remainingMs,
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

		if (!resource.isUnlocked || !resource.isAutomated || resource.isPaused) {
			netAvailable[resourceId] = savedAmount;
			continue;
		}

		const runTimeMultiplier = getRunTimeMultiplier({
			shopBoosts,
			isAutomated: true,
			speedResearchMultiplier: getSpeedResearchMultiplier({
				research,
				resourceId,
			}),
			speedSurgeLevel: state.couponUpgrades?.["speed-surge"] ?? 0,
		});
		const runTime = getEffectiveRunTime({
			resourceId,
			producers: resource.producers,
			runTimeMultiplier,
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
		const gain = getProductionForRuns({
			runs: actualRuns,
			producers: resource.producers,
			productionMul,
			researchMul,
			prestigeMul,
		});
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
	const updatedPrestige = npGain
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
			prestige: updatedPrestige,
		},
		summary: {
			elapsedSeconds,
			gains,
			researchLevelUps,
			wasCapped,
			isTimeWarp: false,
		},
	};
};

export const computeTimeWarp = ({
	state,
	durationSeconds,
	serverNow,
}: {
	state: SerializedGameState;
	durationSeconds: number;
	serverNow: number;
}): {
	updatedState: SerializedGameState;
	summary: SerializedOfflineSummary | null;
} => {
	const durationMs = durationSeconds * 1000;

	const initialLabs = state.labs;

	// Shift researchStartedAt back by durationMs so research advances by exactly
	// that duration (preserving any partial progress in the current level).
	const modifiedLabs = {} as Record<LabId, SerializedLabState>;
	for (const labId of LAB_ORDER) {
		const lab = initialLabs[labId];
		if (lab.activeResearchId !== null && lab.researchStartedAt !== null) {
			modifiedLabs[labId] = {
				...lab,
				researchStartedAt: lab.researchStartedAt - durationMs,
			};
		} else {
			modifiedLabs[labId] = lab;
		}
	}

	// Shift lastSavedAt back so resource production computes exactly durationSeconds.
	const modifiedState: SerializedGameState = {
		...state,
		lastSavedAt: serverNow - durationMs,
		labs: modifiedLabs,
	};

	const result = computeOfflineProgress({
		state: modifiedState,
		serverNow,
		skipOfflineCap: true,
	});

	// Restore lastSavedAt so future offline progress calculations are unaffected.
	const updatedState: SerializedGameState = {
		...result.updatedState,
		lastSavedAt: state.lastSavedAt,
	};

	const summary: SerializedOfflineSummary | null = result.summary
		? {
				...result.summary,
				elapsedSeconds: durationSeconds,
				wasCapped: false,
				isTimeWarp: true,
			}
		: null;

	return { updatedState, summary };
};
