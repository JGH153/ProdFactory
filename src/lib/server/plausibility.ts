import { RESOURCE_CONFIGS, RESOURCE_ORDER } from "@/game/config";
import { createInitialGameState } from "@/game/initial-state";
import { getPrestigePassiveMultiplier } from "@/game/prestige-config";
import { getProductionForRuns } from "@/game/production";
import { advanceResearchLevels } from "@/game/research-calculator";
import {
	getMaxLevelForResearch,
	getResearchMultiplier,
	getResearchTimeMultiplier,
	getSpeedResearchMultiplier,
	LAB_ORDER,
	RESEARCH_ORDER,
} from "@/game/research-config";
import {
	getClampedRunTime,
	getContinuousMultiplier,
	getRunTimeMultiplier,
} from "@/game/run-timing";
import {
	type SerializedGameState,
	type SerializedLabState,
	type SerializedResourceState,
	serializeGameState,
} from "@/game/state/serialization";
import type { LabId, ResearchId, ResourceId } from "@/game/types";
import {
	type BigNum,
	bigNum,
	bnAdd,
	bnDeserialize,
	bnFormat,
	bnGte,
	bnIsZero,
	bnMul,
	bnSerialize,
	bnSub,
	bnToNumber,
} from "@/lib/big-number";
import { logger } from "./logger";
import type { StoredGameState, SyncSnapshot } from "./redis";

const PLAUSIBILITY_TOLERANCE = 1.15;

const INITIAL_GAME_STATE = createInitialGameState();
export const INITIAL_SERIALIZED = serializeGameState(INITIAL_GAME_STATE);

export const stripServerVersion = (
	stored: StoredGameState,
): SerializedGameState => ({
	resources: stored.resources,
	shopBoosts: stored.shopBoosts,
	labs: stored.labs,
	research: stored.research,
	prestige: stored.prestige,
	couponUpgrades: stored.couponUpgrades ?? {
		"producer-discount": 0,
		"offline-capacity": 0,
		"coupon-magnet": 0,
		"speed-surge": 0,
		"music-gemini": 0,
		"music-gemini-calm": 0,
		"music-classic": 0,
	},
	timeWarpCount: stored.timeWarpCount,
	lastSavedAt: stored.lastSavedAt,
	version: stored.version,
});

/**
 * Overlay server-authoritative fields from the stored (or initial) state onto
 * the client's claimed state. Fields that can only change through dedicated
 * action endpoints are restored from the server's copy, preventing spoofing
 * via save/sync requests.
 */
export const buildProtectedState = ({
	claimedState,
	storedState,
	serverNow,
}: {
	claimedState: SerializedGameState;
	storedState: StoredGameState | null;
	serverNow: number;
}): SerializedGameState => {
	const referenceState: SerializedGameState = storedState
		? stripServerVersion(storedState)
		: INITIAL_SERIALIZED;

	// Overlay server-authoritative resource fields
	const protectedResources = {} as Record<ResourceId, SerializedResourceState>;
	for (const resourceId of RESOURCE_ORDER) {
		const claimed = claimedState.resources[resourceId];
		const ref = referenceState.resources[resourceId];
		protectedResources[resourceId] = {
			...claimed,
			producers: ref.producers,
			isUnlocked: ref.isUnlocked,
			isAutomated: ref.isAutomated,
			...(ref.isPaused !== undefined && { isPaused: ref.isPaused }),
		};
	}

	// Overlay server-authoritative lab fields
	const defaultLabs = INITIAL_SERIALIZED.labs as Record<
		LabId,
		SerializedLabState
	>;
	const claimedLabs = claimedState.labs ?? defaultLabs;
	const refLabs = referenceState.labs ?? defaultLabs;
	const protectedLabs = {} as Record<LabId, SerializedLabState>;
	for (const labId of LAB_ORDER) {
		const claimed = claimedLabs[labId];
		const ref = refLabs[labId];
		protectedLabs[labId] = {
			...claimed,
			isUnlocked: ref.isUnlocked,
			activeResearchId: ref.activeResearchId,
			researchStartedAt: ref.researchStartedAt,
		};
	}

	// Overlay prestige fields (only nuclearPastaProducedThisRun is client-updatable)
	const protectedPrestige = {
		...claimedState.prestige,
		prestigeCount: referenceState.prestige.prestigeCount,
		couponBalance: referenceState.prestige.couponBalance,
		lifetimeCoupons: referenceState.prestige.lifetimeCoupons,
		lastPrestigeAt: referenceState.prestige.lastPrestigeAt ?? null,
	};

	return {
		...claimedState,
		resources: protectedResources,
		shopBoosts: referenceState.shopBoosts,
		labs: protectedLabs,
		prestige: protectedPrestige,
		couponUpgrades: referenceState.couponUpgrades ?? {
			"producer-discount": 0,
			"offline-capacity": 0,
			"coupon-magnet": 0,
			"speed-surge": 0,
			"music-gemini": 0,
			"music-gemini-calm": 0,
			"music-classic": 0,
		},
		timeWarpCount: referenceState.timeWarpCount,
		lastSavedAt: serverNow,
	};
};

type PlausibilityResult =
	| { corrected: false; correctedState: null; warnings: string[] }
	| {
			corrected: true;
			correctedState: SerializedGameState;
			warnings: string[];
	  };

const computeMaxResearchLevel = ({
	startLevel,
	elapsedMs,
	researchTimeMultiplier,
	maxLevel,
}: {
	startLevel: number;
	elapsedMs: number;
	researchTimeMultiplier: number;
	maxLevel: number;
}): number =>
	advanceResearchLevels({
		startLevel,
		elapsedMs,
		researchTimeMultiplier,
		maxLevel,
	}).newLevel;

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

	const shopBoosts = claimedState.shopBoosts;
	const productionMul = shopBoosts["production-2x"] ? 2 : 1;
	// Use snapshot's lifetime coupons (trusted) rather than the client's claimed value.
	// Falls back to claimed state for snapshots created before this field was added.
	const trustedLifetimeCoupons =
		lastSnapshot.lifetimeCoupons ?? claimedState.prestige.lifetimeCoupons;
	const prestigeMul = getPrestigePassiveMultiplier({
		lifetimeCoupons: bnDeserialize(trustedLifetimeCoupons),
	});

	let corrected = false;
	const warnings: string[] = [];

	// Research runs first so validated levels feed into the resource production check below
	const validatedResearch = {
		...claimedState.research,
	} as Record<ResearchId, number>;
	const correctedLabs = {
		...claimedState.labs,
	} as Record<LabId, SerializedLabState>;
	let researchCorrected = false;
	let labsCorrected = false;

	if (lastSnapshot.research && lastSnapshot.labs) {
		const researchTimeMultiplier = getResearchTimeMultiplier({ shopBoosts });

		// Validate research levels
		for (const researchId of RESEARCH_ORDER) {
			const snapshotLevel = lastSnapshot.research[researchId] ?? 0;
			const claimedLevel = validatedResearch[researchId] ?? 0;

			// No advancement or decrease — skip
			if (claimedLevel <= snapshotLevel) {
				continue;
			}

			// Hard cap
			const maxLevel = getMaxLevelForResearch(researchId);
			if (claimedLevel > maxLevel) {
				validatedResearch[researchId] = maxLevel;
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
					researchTimeMultiplier,
					maxLevel,
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
						researchTimeMultiplier,
						maxLevel,
					});
					maxAchievableLevel = Math.max(maxAchievableLevel, level);
				}
			}

			// +1 tolerance for clock skew (mirrors the +1 in resource maxRuns)
			if (claimedLevel > maxAchievableLevel + 1) {
				validatedResearch[researchId] = maxAchievableLevel;
				researchCorrected = true;
				corrected = true;
				const elapsedSec = (elapsed / 1000).toFixed(1);
				warnings.push(
					`Research ${researchId} exceeded plausible advancement (claimed: ${claimedLevel}, max: ${maxAchievableLevel}, elapsed: ${elapsedSec}s)`,
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

	const correctedResources = { ...claimedState.resources } as Record<
		ResourceId,
		SerializedResourceState
	>;

	// Compute max production per resource for both resource validation and
	// nuclear-pasta-produced-this-run validation below.
	const computeMaxProduction = (resourceId: ResourceId): BigNum => {
		const snapshotResource = lastSnapshot.resources[resourceId];
		const claimedResource = claimedState.resources[resourceId];
		if (!snapshotResource || !claimedResource) {
			return bigNum(0);
		}
		if (!claimedResource.isUnlocked || (claimedResource.isPaused ?? false)) {
			return bigNum(0);
		}
		const producers = Math.max(
			snapshotResource.producers,
			claimedResource.producers,
		);
		const runTimeMultiplier = getRunTimeMultiplier({
			shopBoosts,
			isAutomated:
				claimedResource.isAutomated && !(claimedResource.isPaused ?? false),
			speedResearchMultiplier: getSpeedResearchMultiplier({
				research: validatedResearch,
				resourceId,
			}),
			speedSurgeLevel: claimedState.couponUpgrades?.["speed-surge"] ?? 0,
		});
		const runTimeMs =
			getClampedRunTime({
				resourceId,
				producers,
				runTimeMultiplier,
			}) * 1000;
		const continuousMul = getContinuousMultiplier({
			resourceId,
			producers,
			runTimeMultiplier,
		});
		const maxRuns = Math.floor(elapsed / runTimeMs) + 1;
		const researchMul = getResearchMultiplier({
			research: validatedResearch,
			resourceId,
		});
		return bnMul(
			getProductionForRuns({
				runs: maxRuns,
				producers,
				productionMul,
				researchMul,
				prestigeMul,
			}),
			bigNum(continuousMul),
		);
	};

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

		const maxProduction = computeMaxProduction(resourceId);
		const elapsedSec = (elapsed / 1000).toFixed(1);

		if (bnIsZero(maxProduction) && !bnIsZero(actualGain)) {
			// Gained resources when none should be possible
			correctedResources[resourceId] = {
				...claimedResource,
				amount: bnSerialize(snapshotAmount),
			};
			corrected = true;
			warnings.push(
				`${config.name} gained ${bnFormat(actualGain)} while locked/paused (elapsed: ${elapsedSec}s)`,
			);
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
			const pct = Math.round(
				(bnToNumber(actualGain) / bnToNumber(maxProduction) - 1) * 100,
			);
			warnings.push(
				`${config.name} production exceeded plausible rate by ${pct}% (gained: ${bnFormat(actualGain)}, max: ${bnFormat(maxProduction)}, elapsed: ${elapsedSec}s)`,
			);
		}
	}

	// Validate nuclearPastaProducedThisRun against plausible nuclear pasta production
	let correctedPrestige = claimedState.prestige;
	if (lastSnapshot.nuclearPastaProducedThisRun) {
		const snapshotNpProduced = bnDeserialize(
			lastSnapshot.nuclearPastaProducedThisRun,
		);
		const claimedNpProduced = bnDeserialize(
			claimedState.prestige.nuclearPastaProducedThisRun,
		);
		const npGain = bnSub(claimedNpProduced, snapshotNpProduced);

		if (!bnIsZero(npGain) && bnGte(claimedNpProduced, snapshotNpProduced)) {
			const maxNpProduction = computeMaxProduction("nuclear-pasta");
			const npTolerance = bnMul(
				maxNpProduction,
				bigNum(PLAUSIBILITY_TOLERANCE),
			);
			if (!bnGte(npTolerance, npGain)) {
				const correctedNpProduced = bnAdd(snapshotNpProduced, maxNpProduction);
				correctedPrestige = {
					...claimedState.prestige,
					nuclearPastaProducedThisRun: bnSerialize(correctedNpProduced),
				};
				corrected = true;
				warnings.push(
					`nuclearPastaProducedThisRun exceeded plausible rate (gained: ${bnFormat(npGain)}, max: ${bnFormat(maxNpProduction)})`,
				);
			}
		}
	}

	if (corrected) {
		logger.warn(
			{ warnings, elapsedMs: elapsed },
			"Plausibility correction applied",
		);
		return {
			corrected: true,
			correctedState: {
				...claimedState,
				resources: correctedResources,
				...(researchCorrected && { research: validatedResearch }),
				...(labsCorrected && { labs: correctedLabs }),
				...(correctedPrestige !== claimedState.prestige && {
					prestige: correctedPrestige,
				}),
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

	const research = {} as Record<ResearchId, number>;
	for (const researchId of RESEARCH_ORDER) {
		research[researchId] = state.research?.[researchId] ?? 0;
	}

	const labs = {} as Record<
		LabId,
		{ activeResearchId: ResearchId | null; researchStartedAt: number | null }
	>;
	for (const labId of LAB_ORDER) {
		const lab = state.labs[labId];
		labs[labId] = {
			activeResearchId: lab.activeResearchId ?? null,
			researchStartedAt: lab.researchStartedAt ?? null,
		};
	}

	return {
		timestamp,
		resources,
		research,
		labs,
		nuclearPastaProducedThisRun: state.prestige.nuclearPastaProducedThisRun,
		lifetimeCoupons: state.prestige.lifetimeCoupons,
	};
};
