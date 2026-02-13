"use client";

import { motion } from "motion/react";
import { Progress } from "@/components/ui/progress";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canStartRun, getSpeedMilestone } from "@/game/logic";
import { useSfx } from "@/game/sfx-context";
import type { ResourceState } from "@/game/types";
import { useParticleBurst } from "@/game/use-particle-burst";
import { bnFormat } from "@/lib/big-number";
import { ParticleEffect } from "./particle-effect";
import { ResourceIcon } from "./resource-icon";

type RunButtonProps = {
	resource: ResourceState;
};

export const RunButton = ({ resource }: RunButtonProps) => {
	const { state, startResourceRun } = useGameState();
	const { playClickSfx } = useSfx();
	const { particles, triggerBurst } = useParticleBurst();
	const config = RESOURCE_CONFIGS[resource.id];
	const isRunning = resource.runStartedAt !== null;
	const canRun = canStartRun(state, resource.id);
	const milestone = getSpeedMilestone(resource.producers);

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (canRun && !isRunning) {
			playClickSfx();

			// Trigger particle burst at click position (relative to button)
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			triggerBurst(x, y);

			startResourceRun(resource.id);
		}
	};

	return (
		<motion.button
			type="button"
			whileTap={canRun && !isRunning ? { scale: 0.9 } : undefined}
			onClick={handleClick}
			disabled={!canRun || isRunning}
			className="relative flex flex-col items-center gap-1 w-20 shrink-0 cursor-pointer
				disabled:cursor-not-allowed select-none overflow-visible"
		>
			{/* Particle container */}
			<div className="absolute inset-0 pointer-events-none">
				<ParticleEffect particles={particles} />
			</div>

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
			{resource.producers > 0 && (
				<div className="relative w-full">
					<Progress
						value={milestone.progress * 100}
						className="h-5 w-full rounded-sm bg-border *:data-[slot=progress-indicator]:bg-accent-amber *:data-[slot=progress-indicator]:rounded-sm"
					/>
					<span
						className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-text-primary"
						style={{
							WebkitTextStroke: "2.5px #1a1a2e",
							paintOrder: "stroke fill",
						}}
					>
						{milestone.current}/{milestone.next}
					</span>
				</div>
			)}
		</motion.button>
	);
};
