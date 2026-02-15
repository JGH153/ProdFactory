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
	getContinuousMultiplier,
	getEffectiveRunTime,
	getRunTimeMultiplier,
} from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { useParticleBurst } from "@/game/use-particle-burst";
import { useRunProgress } from "@/game/use-run-progress";
import { bigNum, bnFormat, bnMul } from "@/lib/big-number";

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
	return `${seconds}s`;
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
	return Math.max(0, clampedRunTime - Math.floor(progress * clampedRunTime));
};

const getStatusText = ({
	isPaused,
	isWaitingForInput,
	inputResourceName,
	isRunning,
	isContinuous,
	remainingSeconds,
	effectiveRunTime,
	producers,
	productionMul,
}: {
	isPaused: boolean;
	isWaitingForInput: boolean;
	inputResourceName: string | null;
	isRunning: boolean;
	isContinuous: boolean;
	remainingSeconds: number;
	effectiveRunTime: number;
	producers: number;
	productionMul: number;
}): string => {
	if (isPaused) {
		return "Paused";
	}
	if (isWaitingForInput && inputResourceName) {
		return `Waiting for ${inputResourceName}...`;
	}
	if (isRunning && isContinuous) {
		return `${formatRunTime(remainingSeconds)}/run · ${bnFormat(bigNum((producers * productionMul) / effectiveRunTime))}/s`;
	}
	if (isRunning) {
		return `${remainingSeconds}s`;
	}
	return `${formatRunTime(effectiveRunTime)}`;
};

type Props = {
	resource: ResourceState;
};

export const ProgressBar = ({ resource }: Props) => {
	const { state } = useGameState();
	const rtm = getRunTimeMultiplier({
		shopBoosts: state.shopBoosts,
		isAutomated: resource.isAutomated && !resource.isPaused,
	});
	const { progress, isContinuous } = useRunProgress({
		resource,
		runTimeMultiplier: rtm,
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

	const effectiveRunTime = getEffectiveRunTime({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier: rtm,
	});
	const clampedRunTime = getClampedRunTime({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier: rtm,
	});
	const remainingSeconds = getRemainingSeconds({
		isRunning,
		isContinuous,
		effectiveRunTime,
		clampedRunTime,
		progress,
	});

	const productionMul = state.shopBoosts["production-2x"] ? 2 : 1;
	const continuousMul = getContinuousMultiplier({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier: rtm,
	});
	const perRun = bnMul(
		bigNum(resource.producers * productionMul),
		bigNum(continuousMul),
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
					{getStatusText({
						isPaused,
						isWaitingForInput,
						inputResourceName,
						isRunning,
						isContinuous,
						remainingSeconds,
						effectiveRunTime,
						producers: resource.producers,
						productionMul,
					})}
				</span>
				{resource.producers > 0 && !isPaused && !isWaitingForInput && (
					<span className="text-xs text-text-muted">
						+{bnFormat(perRun)}/run
					</span>
				)}
			</div>
		</div>
	);
};
