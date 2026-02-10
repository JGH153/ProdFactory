"use client";

import { AnimatePresence, motion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canStartRun } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { useRunProgress } from "@/game/use-run-progress";

type ProgressBarProps = {
	resource: ResourceState;
};

export const ProgressBar = ({ resource }: ProgressBarProps) => {
	const { state } = useGameState();
	const progress = useRunProgress(resource);
	const config = RESOURCE_CONFIGS[resource.id];
	const isRunning = resource.runStartedAt !== null;
	const isPaused = resource.isAutomated && resource.isPaused && !isRunning;
	const isWaitingForInput =
		resource.isAutomated &&
		!resource.isPaused &&
		!isRunning &&
		!canStartRun(state, resource.id);

	const remainingSeconds = isRunning
		? Math.max(
				0,
				config.baseRunTime - Math.floor(progress * config.baseRunTime),
			)
		: config.baseRunTime;

	const inputResourceName = config.inputResourceId
		? RESOURCE_CONFIGS[config.inputResourceId].name
		: null;

	return (
		<div className="relative w-full">
			<Progress
				value={progress * 100}
				className="h-3 bg-border [&>[data-slot=progress-indicator]]:bg-primary *:data-[slot=progress-indicator]:transition-none!"
			/>
			<div className="flex justify-between mt-1">
				<span
					className={`text-xs ${isPaused || isWaitingForInput ? "text-accent-amber" : "text-text-muted"}`}
				>
					{isPaused
						? "Paused"
						: isWaitingForInput && inputResourceName
							? `Waiting for ${inputResourceName}...`
							: isRunning
								? `${remainingSeconds}s`
								: `${config.baseRunTime}s`}
				</span>
			</div>
			<AnimatePresence>
				{progress >= 1 && (
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
	);
};
