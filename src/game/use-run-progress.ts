"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getClampedRunTime, isContinuousMode } from "./logic";
import type { ResourceState } from "./types";

type RunProgress = {
	progress: number;
	isContinuous: boolean;
};

/**
 * Returns 0-1 progress for an active run and continuous mode flag.
 * In continuous mode, skips RAF loop entirely (always returns progress=1).
 */
export const useRunProgress = ({
	resource,
	runTimeMultiplier = 1,
}: {
	resource: ResourceState;
	runTimeMultiplier?: number;
}): RunProgress => {
	const [progress, setProgress] = useState(0);
	const rafRef = useRef<number>(0);

	const runStartedAt = resource.runStartedAt;
	const continuous = isContinuousMode({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier,
	});
	const runTimeMs =
		getClampedRunTime({
			resourceId: resource.id,
			producers: resource.producers,
			runTimeMultiplier,
		}) * 1000;

	const tick = useCallback(() => {
		if (runStartedAt === null) {
			return;
		}

		const elapsed = Date.now() - runStartedAt;
		const newProgress = Math.min(1, Math.max(0, elapsed / runTimeMs));
		setProgress(newProgress);

		if (newProgress < 1) {
			rafRef.current = requestAnimationFrame(tick);
		}
	}, [runStartedAt, runTimeMs]);

	useEffect(() => {
		if (runStartedAt === null) {
			setProgress(0);
			return;
		}

		// In continuous mode, always show full bar — no RAF needed
		if (continuous) {
			setProgress(1);
			return;
		}

		rafRef.current = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(rafRef.current);
		};
	}, [runStartedAt, tick, continuous]);

	return { progress, isContinuous: continuous };
};
