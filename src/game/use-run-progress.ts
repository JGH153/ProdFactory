"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RESOURCE_CONFIGS } from "./config";
import type { ResourceState } from "./types";

/**
 * Returns 0-1 progress for an active run.
 * Only triggers per-frame re-renders while a run is active.
 */
export const useRunProgress = (resource: ResourceState): number => {
	const [progress, setProgress] = useState(0);
	const rafRef = useRef<number>(0);

	const config = RESOURCE_CONFIGS[resource.id];
	const runStartedAt = resource.runStartedAt;
	const runTimeMs = config.baseRunTime * 1000;

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

		rafRef.current = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(rafRef.current);
		};
	}, [runStartedAt, tick]);

	return progress;
};
