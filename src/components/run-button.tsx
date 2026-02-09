"use client";

import { motion } from "motion/react";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canStartRun } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bnFormat } from "@/lib/big-number";
import { ResourceIcon } from "./resource-icon";

type RunButtonProps = {
	resource: ResourceState;
};

export const RunButton = ({ resource }: RunButtonProps) => {
	const { state, startResourceRun } = useGameState();
	const config = RESOURCE_CONFIGS[resource.id];
	const isRunning = resource.runStartedAt !== null;
	const canRun = canStartRun(state, resource.id);

	const handleClick = () => {
		if (canRun && !isRunning) {
			startResourceRun(resource.id);
		}
	};

	return (
		<motion.button
			type="button"
			whileTap={canRun && !isRunning ? { scale: 0.9 } : undefined}
			onClick={handleClick}
			disabled={!canRun || isRunning}
			className="flex flex-col items-center gap-1 w-20 shrink-0 cursor-pointer
				disabled:cursor-not-allowed disabled:opacity-60 select-none"
		>
			<motion.div
				animate={isRunning ? { rotate: [0, 5, -5, 0] } : undefined}
				transition={
					isRunning
						? { repeat: Number.POSITIVE_INFINITY, duration: 0.5 }
						: undefined
				}
			>
				<ResourceIcon resourceId={resource.id} size={36} />
			</motion.div>
			<span className="text-xs font-medium text-text-secondary">
				{config.name}
			</span>
			<span className="text-sm font-bold text-primary">
				{bnFormat(resource.amount)}
			</span>
			<span className="text-xs text-text-muted">x{resource.producers}</span>
		</motion.button>
	);
};
