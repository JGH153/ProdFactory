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

type FormattedTime = { text: string; title: string | undefined; suffix: string | undefined };

const formatRunTime = (seconds: number): FormattedTime => {
	const ms = seconds * 1000;
	if (ms < 0.000000000001) {
		const as = ms * 1_000_000_000_000_000;
		return { text: `${parseFloat(as.toPrecision(2))}as`, title: "attoseconds", suffix: undefined };
	}
	if (ms < 0.000000001) {
		const fs = ms * 1_000_000_000_000;
		return { text: `${parseFloat(fs.toPrecision(2))}fs`, title: "femtoseconds", suffix: undefined };
	}
	if (ms < 0.000001) {
		const ps = ms * 1_000_000_000;
		return { text: `${parseFloat(ps.toPrecision(2))}ps`, title: "picoseconds", suffix: undefined };
	}
	if (ms < 0.001) {
		const ns = ms * 1_000_000;
		return { text: `${parseFloat(ns.toPrecision(2))}ns`, title: "nanoseconds", suffix: undefined };
	}
	if (ms < 0.1) {
		const us = ms * 1000;
		return { text: `${parseFloat(us.toPrecision(2))}µs`, title: undefined, suffix: undefined };
	}
	if (ms < 1) {
		return { text: `${parseFloat(ms.toPrecision(2))}ms`, title: undefined, suffix: undefined };
	}
	if (ms <= 10) {
		return { text: `${Math.round(ms)}ms`, title: undefined, suffix: undefined };
	}
	if (Number.isInteger(seconds)) {
		return { text: `${seconds}s`, title: undefined, suffix: undefined };
	}
	return { text: `${seconds.toFixed(2)}s`, title: undefined, suffix: undefined };
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
}): FormattedTime => {
	if (isPaused) {
		return { text: "Paused", title: undefined, suffix: undefined };
	}
	if (isWaitingForInput && inputResourceName) {
		return { text: `Waiting for ${inputResourceName}...`, title: undefined, suffix: undefined };
	}
	if (isRunning && isContinuous) {
		const rt = formatRunTime(remainingSeconds);
		return { text: `${rt.text}/run`, title: rt.title, suffix: ` · ${perSecondFormatted}/s` };
	}
	if (isRunning) {
		return formatRunTime(remainingSeconds);
	}
	return formatRunTime(effectiveRunTime);
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

	const status = getStatusText({
		isPaused,
		isWaitingForInput,
		inputResourceName,
		isRunning,
		isContinuous,
		remainingSeconds,
		effectiveRunTime,
		perSecondFormatted,
	});

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
					<span title={status.title}>{status.text}</span>
					{status.suffix}
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
