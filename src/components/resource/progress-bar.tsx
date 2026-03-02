"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useParticleBurst } from "@/game/hooks/use-particle-burst";
import { useResourceRuntime } from "@/game/hooks/use-resource-runtime";
import { useRunProgress } from "@/game/hooks/use-run-progress";
import { canStartRun } from "@/game/runs";
import { useGameState } from "@/game/state/game-state-context";
import type { ResourceState } from "@/game/types";
import { bigNum, bnFormat } from "@/lib/big-number";
import { ParticleEffect } from "./particle-effect";

const formatRunTime = (seconds: number): string => {
	const ms = seconds * 1000;
	if (ms < 0.001) {
		const ns = ms * 1_000_000;
		return `${parseFloat(ns.toPrecision(2))}ns`;
	}
	if (ms < 0.1) {
		const us = ms * 1000;
		return `${parseFloat(us.toPrecision(2))}µs`;
	}
	if (ms < 1) {
		return `${parseFloat(ms.toPrecision(2))}ms`;
	}
	if (ms <= 10) {
		return `${Math.round(ms)}ms`;
	}
	if (Number.isInteger(seconds)) {
		return `${seconds}s`;
	}
	return `${seconds.toFixed(2)}s`;
};

const getRemainingSeconds = ({
	isRunning,
	isContinuous,
	effectiveRunTime,
	clampedRunTime,
	progress,
}: {
	isRunning: boolean;
	isContinuous: boolean;
	effectiveRunTime: number;
	clampedRunTime: number;
	progress: number;
}): number => {
	if (!isRunning) {
		return effectiveRunTime;
	}
	if (isContinuous) {
		return effectiveRunTime;
	}
	return Math.max(0, Math.ceil(clampedRunTime - progress * clampedRunTime));
};

const getStatusText = ({
	isPaused,
	isWaitingForInput,
	inputResourceName,
	isRunning,
	isContinuous,
	remainingSeconds,
	effectiveRunTime,
	perSecondFormatted,
}: {
	isPaused: boolean;
	isWaitingForInput: boolean;
	inputResourceName: string | null;
	isRunning: boolean;
	isContinuous: boolean;
	remainingSeconds: number;
	effectiveRunTime: number;
	perSecondFormatted: string;
}): string => {
	if (isPaused) {
		return "Paused";
	}
	if (isWaitingForInput && inputResourceName) {
		return `Waiting for ${inputResourceName}...`;
	}
	if (isRunning && isContinuous) {
		return `${formatRunTime(remainingSeconds)}/run · ${perSecondFormatted}/s`;
	}
	if (isRunning) {
		return `${formatRunTime(remainingSeconds)}`;
	}
	return `${formatRunTime(effectiveRunTime)}`;
};

type Props = {
	resource: ResourceState;
};

export const ProgressBar = ({ resource }: Props) => {
	const { state } = useGameState();
	const {
		runTimeMultiplier,
		effectiveRunTime,
		clampedRunTime,
		perRun,
		productionMul,
		researchMul,
		prestigeMul,
	} = useResourceRuntime({ state, resource });
	const { progress, isContinuous } = useRunProgress({
		resource,
		runTimeMultiplier,
	});
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

	const remainingSeconds = getRemainingSeconds({
		isRunning,
		isContinuous,
		effectiveRunTime,
		clampedRunTime,
		progress,
	});

	const perSecondFormatted = bnFormat(
		bigNum(
			(resource.producers * productionMul * researchMul * prestigeMul) /
				effectiveRunTime,
		),
	);

	const inputResourceName = config.inputResourceId
		? RESOURCE_CONFIGS[config.inputResourceId].name
		: null;

	return (
		<div className="w-full">
			<div ref={barRef} className="relative overflow-visible">
				<ParticleEffect particles={particles} />
				<Progress
					value={isContinuous && isRunning ? 100 : progress * 100}
					aria-label={`Production progress for ${config.name}`}
					className={`h-3 bg-border *:data-[slot=progress-indicator]:bg-primary *:data-[slot=progress-indicator]:transition-none! ${isContinuous && isRunning ? "animate-shimmer" : ""}`}
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
			<div
				className="flex justify-between mt-1"
				role={isPaused || isWaitingForInput ? "status" : undefined}
				aria-live={isPaused || isWaitingForInput ? "polite" : "off"}
			>
				<span
					className={`text-xs truncate ${isPaused || isWaitingForInput ? "text-accent-amber" : "text-text-muted"}`}
				>
					{getStatusText({
						isPaused,
						isWaitingForInput,
						inputResourceName,
						isRunning,
						isContinuous,
						remainingSeconds,
						effectiveRunTime,
						perSecondFormatted,
					})}
				</span>
				{resource.producers > 0 && !isPaused && !isWaitingForInput && (
					<span className="text-xs text-text-muted shrink-0">
						+{bnFormat(perRun)}/run
					</span>
				)}
			</div>
		</div>
	);
};
