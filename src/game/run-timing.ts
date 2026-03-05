import { RESOURCE_CONFIGS } from "./config";
import { getSpeedSurgeMultiplier } from "./coupon-shop-config";
import type { ResourceId, ShopBoosts } from "./types";

export const SPEED_MILESTONE_INTERVAL = 10;
const CONTINUOUS_THRESHOLD = 0.5;

export const getRunTimeMultiplier = ({
	shopBoosts,
	isAutomated,
	speedResearchMultiplier = 1,
	speedSurgeLevel = 0,
}: {
	shopBoosts: ShopBoosts;
	isAutomated: boolean;
	speedResearchMultiplier?: number;
	speedSurgeLevel?: number;
}): number => {
	let m = 1;
	if (shopBoosts["runtime-50"]) {
		m *= 0.5;
	}
	if (shopBoosts["automation-2x"] && isAutomated) {
		m *= 0.5;
	}
	m *= speedResearchMultiplier;
	if (speedSurgeLevel > 0) {
		m *= getSpeedSurgeMultiplier({ level: speedSurgeLevel });
	}
	return m;
};

/** Get effective run time after speed milestones (halves every 10 producers) */
export const getEffectiveRunTime = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): number => {
	const config = RESOURCE_CONFIGS[resourceId];
	const speedDoublings = Math.floor(producers / SPEED_MILESTONE_INTERVAL);
	return (config.baseRunTime / 2 ** speedDoublings) * runTimeMultiplier;
};

/** Whether a resource is in continuous mode (effective run time below threshold) */
export const isContinuousMode = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): boolean =>
	getEffectiveRunTime({ resourceId, producers, runTimeMultiplier }) <
	CONTINUOUS_THRESHOLD;

/** Multiplier to compensate for clamped tick rate in continuous mode */
export const getContinuousMultiplier = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): number => {
	const effective = getEffectiveRunTime({
		resourceId,
		producers,
		runTimeMultiplier,
	});
	if (effective >= CONTINUOUS_THRESHOLD) {
		return 1;
	}
	return CONTINUOUS_THRESHOLD / effective;
};

export const getClampedRunTime = ({
	resourceId,
	producers,
	runTimeMultiplier = 1,
}: {
	resourceId: ResourceId;
	producers: number;
	runTimeMultiplier?: number;
}): number =>
	Math.max(
		getEffectiveRunTime({ resourceId, producers, runTimeMultiplier }),
		CONTINUOUS_THRESHOLD,
	);

export const getSpeedMilestone = (
	producers: number,
): { current: number; next: number; progress: number } => {
	const milestone = Math.floor(producers / SPEED_MILESTONE_INTERVAL);
	const next = (milestone + 1) * SPEED_MILESTONE_INTERVAL;
	const progressInMilestone =
		(producers % SPEED_MILESTONE_INTERVAL) / SPEED_MILESTONE_INTERVAL;
	return { current: producers, next, progress: progressInMilestone };
};
