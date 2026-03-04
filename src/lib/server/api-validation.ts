import { RESOURCE_ORDER } from "@/game/config";
import {
	getMaxLevelForResearch,
	LAB_ORDER,
	RESEARCH_ORDER,
} from "@/game/research-config";
import type { LabId, ResearchId, ResourceId, ShopBoostId } from "@/game/types";
import type { SerializedBigNum } from "@/lib/big-number";

const VALID_RESOURCE_IDS: ReadonlySet<string> = new Set<string>([
	"iron-ore",
	"plates",
	"reinforced-plate",
	"modular-frame",
	"heavy-modular-frame",
	"fused-modular-frame",
	"pressure-conversion-cube",
	"nuclear-pasta",
]);

const VALID_BOOST_IDS: ReadonlySet<string> = new Set<string>([
	"production-20x",
	"automation-2x",
	"runtime-50",
	"research-2x",
	"offline-2h",
]);

const VALID_LAB_IDS: ReadonlySet<string> = new Set<string>(LAB_ORDER);

const VALID_RESEARCH_IDS: ReadonlySet<string> = new Set<string>(RESEARCH_ORDER);

export const isRecord = (value: unknown): value is Record<string, unknown> => {
	return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const isValidResourceId = (value: unknown): value is ResourceId => {
	return typeof value === "string" && VALID_RESOURCE_IDS.has(value);
};

export const isValidBoostId = (value: unknown): value is ShopBoostId => {
	return typeof value === "string" && VALID_BOOST_IDS.has(value);
};

export const isValidLabId = (value: unknown): value is LabId => {
	return typeof value === "string" && VALID_LAB_IDS.has(value);
};

export const isValidResearchId = (value: unknown): value is ResearchId => {
	return typeof value === "string" && VALID_RESEARCH_IDS.has(value);
};

export const isNonNegativeInteger = (value: unknown): value is number => {
	return typeof value === "number" && Number.isInteger(value) && value >= 0;
};

const isValidSerializedBigNum = (value: unknown): value is SerializedBigNum => {
	if (!isRecord(value)) {
		return false;
	}
	if (typeof value.m !== "number" || typeof value.e !== "number") {
		return false;
	}
	if (value.m === 0 && value.e === 0) {
		return true;
	}
	if (!Number.isFinite(value.m)) {
		return false;
	}
	if (value.m < 1 || value.m >= 10) {
		return false;
	}
	if (!Number.isFinite(value.e) || !Number.isInteger(value.e)) {
		return false;
	}
	if (value.e < 0 || value.e > 1000) {
		return false;
	}
	return true;
};

const validateSerializedResource = ({
	resource,
	expectedId,
}: {
	resource: Record<string, unknown>;
	expectedId: string;
}): string | null => {
	if (resource.id !== expectedId) {
		return `Resource id mismatch: expected ${expectedId}`;
	}
	if (!isValidSerializedBigNum(resource.amount)) {
		return `Invalid amount for ${expectedId}`;
	}
	if (!isNonNegativeInteger(resource.producers)) {
		return `Invalid producers for ${expectedId}`;
	}
	if (typeof resource.isUnlocked !== "boolean") {
		return `Invalid isUnlocked for ${expectedId}`;
	}
	if (typeof resource.isAutomated !== "boolean") {
		return `Invalid isAutomated for ${expectedId}`;
	}
	if (
		resource.isPaused !== undefined &&
		typeof resource.isPaused !== "boolean"
	) {
		return `Invalid isPaused for ${expectedId}`;
	}
	if (
		resource.runStartedAt !== null &&
		typeof resource.runStartedAt !== "number"
	) {
		return `Invalid runStartedAt for ${expectedId}`;
	}
	return null;
};

export const validateSerializedGameState = (
	state: Record<string, unknown>,
): string | null => {
	if (typeof state.lastSavedAt !== "number") {
		return "Missing or invalid lastSavedAt";
	}
	if (typeof state.version !== "number") {
		return "Missing or invalid version";
	}
	if (!isRecord(state.resources)) {
		return "Missing or invalid resources";
	}

	for (const id of RESOURCE_ORDER) {
		const resource = (state.resources as Record<string, unknown>)[id];
		if (!resource) {
			return `Missing resource: ${id}`;
		}
		if (!isRecord(resource)) {
			return `Invalid resource shape: ${id}`;
		}
		const error = validateSerializedResource({ resource, expectedId: id });
		if (error !== null) {
			return error;
		}
	}

	if (state.shopBoosts !== undefined) {
		if (!isRecord(state.shopBoosts)) {
			return "Invalid shopBoosts";
		}
		for (const key of Object.keys(state.shopBoosts)) {
			if (!VALID_BOOST_IDS.has(key)) {
				return `Invalid boost id: ${key}`;
			}
			if (typeof state.shopBoosts[key] !== "boolean") {
				return `Invalid boost value for ${key}`;
			}
		}
	}

	if (state.labs !== undefined) {
		if (!isRecord(state.labs)) {
			return "Invalid labs";
		}
		for (const id of LAB_ORDER) {
			const lab = (state.labs as Record<string, unknown>)[id];
			if (lab !== undefined) {
				if (!isRecord(lab)) {
					return `Invalid lab shape: ${id}`;
				}
				if (typeof lab.isUnlocked !== "boolean") {
					return `Invalid isUnlocked for lab ${id}`;
				}
				if (
					lab.activeResearchId !== null &&
					!isValidResearchId(lab.activeResearchId)
				) {
					return `Invalid activeResearchId for lab ${id}`;
				}
				if (
					lab.researchStartedAt !== null &&
					typeof lab.researchStartedAt !== "number"
				) {
					return `Invalid researchStartedAt for lab ${id}`;
				}
			}
		}
	}

	if (state.research !== undefined) {
		if (!isRecord(state.research)) {
			return "Invalid research";
		}
		for (const id of RESEARCH_ORDER) {
			const level = (state.research as Record<string, unknown>)[id];
			if (level !== undefined && !isNonNegativeInteger(level)) {
				return `Invalid research level for ${id}`;
			}
			if (typeof level === "number" && level > getMaxLevelForResearch(id)) {
				return `Research level exceeds maximum for ${id}`;
			}
		}
	}

	if (state.prestige !== undefined) {
		if (!isRecord(state.prestige)) {
			return "Invalid prestige";
		}
		if (!isNonNegativeInteger(state.prestige.prestigeCount)) {
			return "Invalid prestige count";
		}
		if (!isValidSerializedBigNum(state.prestige.couponBalance)) {
			return "Invalid coupon balance";
		}
		if (!isValidSerializedBigNum(state.prestige.lifetimeCoupons)) {
			return "Invalid lifetime coupons";
		}
		if (!isValidSerializedBigNum(state.prestige.nuclearPastaProducedThisRun)) {
			return "Invalid nuclear pasta produced this run";
		}
	}

	return null;
};
