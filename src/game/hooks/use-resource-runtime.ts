"use client";

import { getProductionParams } from "@/game/production";
import { getSpeedResearchMultiplier } from "@/game/research-config";
import {
	getClampedRunTime,
	getEffectiveRunTime,
	getRunTimeMultiplier,
} from "@/game/run-timing";
import type { GameState, ResourceState } from "@/game/types";

/**
 * Computes all runtime and production multipliers for a resource.
 * Replaces the repeated getRunTimeMultiplier → getEffectiveRunTime
 * pattern across resource components.
 */
export const useResourceRuntime = ({
	state,
	resource,
}: {
	state: GameState;
	resource: ResourceState;
}) => {
	const runTimeMultiplier = getRunTimeMultiplier({
		shopBoosts: state.shopBoosts,
		isAutomated: resource.isAutomated && !resource.isPaused,
		speedResearchMultiplier: getSpeedResearchMultiplier({
			research: state.research,
			resourceId: resource.id,
		}),
		speedSurgeLevel: state.couponUpgrades["speed-surge"],
	});

	const effectiveRunTime = getEffectiveRunTime({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier,
	});

	const clampedRunTime = getClampedRunTime({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier,
	});

	const productionParams = getProductionParams({
		state,
		resourceId: resource.id,
	});

	return {
		effectiveRunTime,
		clampedRunTime,
		...productionParams,
	};
};
