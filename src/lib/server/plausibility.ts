import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { getEffectiveRunTime, getRunTimeMultiplier } from "@/game/logic";
import {
	getResearchTime,
	getResearchTimeMultiplier,
	LAB_ORDER,
	MAX_RESEARCH_LEVEL,
	RESEARCH_BONUS_PER_LEVEL,
	RESEARCH_ORDER,
} from "@/game/research-config";
import type {
	SerializedGameState,
	SerializedLabState,
	SerializedResourceState,
} from "@/game/state/serialization";
import type { LabId, ResearchId, ResourceId } from "@/game/types";
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
import type { SyncSnapshot } from "./redis";

const PLAUSIBILITY_TOLERANCE = 1.1;

type PlausibilityResult =
	| { corrected: false; correctedState: null; warnings: string[] }
	| {
			corrected: true;
			correctedState: SerializedGameState;
			warnings: string[];
	  };

/** Compute the maximum research level reachable from `startLevel` given elapsed ms. */
const computeMaxResearchLevel = ({
	startLevel,
	elapsedMs,
	researchTimeMultiplier,
}: {
	startLevel: number;
	elapsedMs: number;
	researchTimeMultiplier: number;
}): number => {
	let level = startLevel;
	let remaining = elapsedMs;
	while (level < MAX_RESEARCH_LEVEL) {
		const levelTimeMs = getResearchTime(level) * 1000 * researchTimeMultiplier;
		if (remaining < levelTimeMs) {
			break;
		}
		remaining -= levelTimeMs;
		level++;
	}
	return level;
};

export const checkPlausibility = ({
	claimedState,
	lastSnapshot,
	serverNow,
}: {
	claimedState: SerializedGameState;
	lastSnapshot: SyncSnapshot;
	serverNow: number;
}): PlausibilityResult => {
	const elapsed = serverNow - lastSnapshot.timestamp;

	if (elapsed <= 0) {
		return { corrected: false, correctedState: null, warnings: [] };
	}

	const defaultBoosts = createInitialGameState().shopBoosts;
	const shopBoosts = claimedState.shopBoosts ?? defaultBoosts;
	const productionMul = shopBoosts["production-20x"] ? 20 : 1;

	let corrected = false;
	const warnings: string[] = [];

	// --- Research plausibility (runs first so validated levels feed into resource check) ---

	const validatedResearch = {
		...(claimedState.research ?? createInitialGameState().research),
	} as Record<ResearchId, number>;
	const correctedLabs = {
		...(claimedState.labs ?? createInitialGameState().labs),
	} as Record<LabId, SerializedLabState>;
	let researchCorrected = false;
	let labsCorrected = false;

	if (lastSnapshot.research && lastSnapshot.labs) {
		const rtm = getResearchTimeMultiplier({ shopBoosts });

		// Validate research levels
		for (const researchId of RESEARCH_ORDER) {
			const snapshotLevel = lastSnapshot.research[researchId] ?? 0;
			const claimedLevel = validatedResearch[researchId] ?? 0;

			// No advancement or decrease — skip
			if (claimedLevel <= snapshotLevel) {
				continue;
			}

			// Hard cap
			if (claimedLevel > MAX_RESEARCH_LEVEL) {
				validatedResearch[researchId] = MAX_RESEARCH_LEVEL;
				researchCorrected = true;
				corrected = true;
				warnings.push(`Research ${researchId} level exceeds maximum`);
				continue;
			}

			// Compute max achievable level from labs that were researching this at snapshot time
			let maxAchievableLevel = snapshotLevel;

			for (const labId of LAB_ORDER) {
				const snapshotLab = lastSnapshot.labs[labId];
				if (
					snapshotLab.activeResearchId !== researchId ||
					snapshotLab.researchStartedAt === null
				) {
					continue;
				}
				const elapsedMs = serverNow - snapshotLab.researchStartedAt;
				const level = computeMaxResearchLevel({
					startLevel: snapshotLevel,
					elapsedMs,
					researchTimeMultiplier: rtm,
				});
				maxAchievableLevel = Math.max(maxAchievableLevel, level);
			}

			// Also check labs assigned after the snapshot (server sets researchStartedAt)
			for (const labId of LAB_ORDER) {
				const claimedLab = correctedLabs[labId];
				const snapshotLab = lastSnapshot.labs[labId];
				if (claimedLab.activeResearchId !== researchId) {
					continue;
				}
				// Already handled above
				if (snapshotLab.activeResearchId === researchId) {
					continue;
				}
				// Post-snapshot assignment: researchStartedAt must be >= snapshot timestamp
				if (
					claimedLab.researchStartedAt !== null &&
					claimedLab.researchStartedAt >= lastSnapshot.timestamp
				) {
					const elapsedMs = serverNow - claimedLab.researchStartedAt;
					const level = computeMaxResearchLevel({
						startLevel: snapshotLevel,
						elapsedMs,
						researchTimeMultiplier: rtm,
					});
					maxAchievableLevel = Math.max(maxAchievableLevel, level);
				}
			}

			// +1 tolerance for clock skew (mirrors the +1 in resource maxRuns)
			if (claimedLevel > maxAchievableLevel + 1) {
				validatedResearch[researchId] = maxAchievableLevel;
				researchCorrected = true;
				corrected = true;
				warnings.push(
					`Research ${researchId} level exceeded plausible advancement`,
				);
			}
		}

		// Validate researchStartedAt timestamps
		for (const labId of LAB_ORDER) {
			const claimedLab = correctedLabs[labId];
			if (claimedLab.researchStartedAt === null) {
				continue;
			}

			const snapshotLab = lastSnapshot.labs[labId];

			// Future timestamp — clamp to serverNow
			if (claimedLab.researchStartedAt > serverNow) {
				correctedLabs[labId] = {
					...claimedLab,
					researchStartedAt: serverNow,
				};
				labsCorrected = true;
				corrected = true;
				warnings.push(`Lab ${labId} researchStartedAt was in the future`);
				continue;
			}

			// Same research as snapshot — must not be earlier than snapshot's value
			if (
				snapshotLab.activeResearchId === claimedLab.activeResearchId &&
				snapshotLab.researchStartedAt !== null &&
				claimedLab.researchStartedAt < snapshotLab.researchStartedAt
			) {
				correctedLabs[labId] = {
					...claimedLab,
					researchStartedAt: snapshotLab.researchStartedAt,
				};
				labsCorrected = true;
				corrected = true;
				warnings.push(`Lab ${labId} researchStartedAt was backdated`);
				continue;
			}

			// New assignment — must be >= snapshot timestamp
			if (
				snapshotLab.activeResearchId !== claimedLab.activeResearchId &&
				claimedLab.researchStartedAt < lastSnapshot.timestamp
			) {
				correctedLabs[labId] = {
					...claimedLab,
					researchStartedAt: lastSnapshot.timestamp,
				};
				labsCorrected = true;
				corrected = true;
				warnings.push(`Lab ${labId} researchStartedAt was backdated`);
			}
		}
	}

	// --- Resource production plausibility (uses validated research levels) ---

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
			const producers = Math.max(
				snapshotResource.producers,
				claimedResource.producers,
			);
			const rtm = getRunTimeMultiplier({
				shopBoosts,
				isAutomated:
					claimedResource.isAutomated && !(claimedResource.isPaused ?? false),
			});
			const runTimeMs =
				getEffectiveRunTime({
					resourceId,
					producers,
					runTimeMultiplier: rtm,
				}) * 1000;
			// +1 accounts for a run already in-progress when the snapshot was taken
			const maxRuns = Math.floor(elapsed / runTimeMs) + 1;
			const researchLevel =
				validatedResearch[`more-${resourceId}` as ResearchId] ?? 0;
			const researchMul = 1 + researchLevel * RESEARCH_BONUS_PER_LEVEL;
			maxProduction = bigNum(maxRuns * producers * productionMul * researchMul);
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
		console.warn("[plausibility]", warnings, `elapsed=${elapsed}ms`);
		return {
			corrected: true,
			correctedState: {
				...claimedState,
				resources: correctedResources,
				...(researchCorrected && { research: validatedResearch }),
				...(labsCorrected && { labs: correctedLabs }),
			},
			warnings,
		};
	}

	return { corrected: false, correctedState: null, warnings: [] };
};

export const buildSyncSnapshot = ({
	state,
	timestamp,
}: {
	state: SerializedGameState;
	timestamp: number;
}): SyncSnapshot => {
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

	const defaultState = createInitialGameState();

	const research = {} as Record<ResearchId, number>;
	for (const researchId of RESEARCH_ORDER) {
		research[researchId] = state.research?.[researchId] ?? 0;
	}

	const labs = {} as Record<
		LabId,
		{ activeResearchId: ResearchId | null; researchStartedAt: number | null }
	>;
	for (const labId of LAB_ORDER) {
		const lab = state.labs?.[labId] ?? defaultState.labs[labId];
		labs[labId] = {
			activeResearchId: lab.activeResearchId ?? null,
			researchStartedAt: lab.researchStartedAt ?? null,
		};
	}

	return { timestamp, resources, research, labs };
};
