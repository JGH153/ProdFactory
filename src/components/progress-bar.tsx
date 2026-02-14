"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { ParticleEffect } from "@/components/particle-effect";
import { Progress } from "@/components/ui/progress";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import {
	canStartRun,
	getClampedRunTime,
	getEffectiveRunTime,
} from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { useParticleBurst } from "@/game/use-particle-burst";
import { useRunProgress } from "@/game/use-run-progress";
import { bigNum, bnFormat } from "@/lib/big-number";

type Props = {
	resource: ResourceState;
};

export const ProgressBar = ({ resource }: Props) => {
	const { state } = useGameState();
	const { progress, isContinuous } = useRunProgress(resource);
	const { particles, triggerBurst } = useParticleBurst();
	const barRef = useRef<HTMLDivElement>(null);
	const wasRunningRef = useRef(false);
	const config = RESOURCE_CONFIGS[resource.id];
	const isRunning = resource.runStartedAt !== null;

	// Detect manual run completion and trigger particle burst
	const isManual = !resource.isAutomated || resource.isPaused;
	useEffect(() => {
		if (wasRunningRef.current && !isRunning && isManual && barRef.current) {
			triggerBurst({
				originX: barRef.current.offsetWidth,
				originY: barRef.current.offsetHeight / 2,
			});
		}
		wasRunningRef.current = isRunning;
	}, [isRunning, isManual, triggerBurst]);

	const isPaused = resource.isAutomated && resource.isPaused && !isRunning;
	const isWaitingForInput =
		resource.isAutomated &&
		!resource.isPaused &&
		!isRunning &&
		!canStartRun({ state, resourceId: resource.id });

	const effectiveRunTime = getEffectiveRunTime({
		resourceId: resource.id,
		producers: resource.producers,
	});
	const clampedRunTime = getClampedRunTime({
		resourceId: resource.id,
		producers: resource.producers,
	});
	const remainingSeconds = isRunning
		? isContinuous
			? effectiveRunTime
			: Math.max(0, clampedRunTime - Math.floor(progress * clampedRunTime))
		: effectiveRunTime;

	const inputResourceName = config.inputResourceId
		? RESOURCE_CONFIGS[config.inputResourceId].name
		: null;

	return (
		<div className="w-full">
			<div ref={barRef} className="relative overflow-visible">
				<ParticleEffect particles={particles} />
				<Progress
					value={isContinuous && isRunning ? 100 : progress * 100}
					className={`h-3 bg-border [&>[data-slot=progress-indicator]]:bg-primary *:data-[slot=progress-indicator]:transition-none! ${isContinuous && isRunning ? "animate-shimmer" : ""}`}
				/>
				<AnimatePresence>
					{!isContinuous && progress >= 1 && (
						<motion.div
							className="absolute inset-0 rounded-full bg-success/30"
							initial={{ opacity: 0.8 }}
							animate={{ opacity: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.5 }}
						/>
					)}
				</AnimatePresence>
			</div>
			<div className="flex justify-between mt-1">
				<span
					className={`text-xs ${isPaused || isWaitingForInput ? "text-accent-amber" : "text-text-muted"}`}
				>
					{isPaused
						? "Paused"
						: isWaitingForInput && inputResourceName
							? `Waiting for ${inputResourceName}...`
							: isRunning
								? isContinuous
									? `${remainingSeconds}s/run · ${bnFormat(bigNum(resource.producers / effectiveRunTime))}/s`
									: `${remainingSeconds}s`
								: `${effectiveRunTime}s`}
				</span>
			</div>
		</div>
	);
};
