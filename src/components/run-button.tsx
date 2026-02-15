"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import {
	canStartRun,
	getRunInputCost,
	getRunTimeMultiplier,
	getSpeedMilestone,
} from "@/game/logic";
import { useSfx } from "@/game/sfx-context";
import type { GameState, ResourceState } from "@/game/types";
import { useParticleBurst } from "@/game/use-particle-burst";
import { bnFormat, bnGte } from "@/lib/big-number";
import { ParticleEffect } from "./particle-effect";
import { ResourceIcon } from "./resource-icon";

const getInsufficientInputMessage = ({
	state,
	resource,
}: {
	state: GameState;
	resource: ResourceState;
}): string | null => {
	const config = RESOURCE_CONFIGS[resource.id];
	if (config.inputResourceId === null) {
		return null;
	}
	const rtm = getRunTimeMultiplier({
		shopBoosts: state.shopBoosts,
		isAutomated: resource.isAutomated && !resource.isPaused,
	});
	const cost = getRunInputCost({
		resourceId: resource.id,
		producers: resource.producers,
		runTimeMultiplier: rtm,
	});
	if (cost === null) {
		return null;
	}
	const inputResource = state.resources[config.inputResourceId];
	if (bnGte(inputResource.amount, cost)) {
		return null;
	}
	const inputName = RESOURCE_CONFIGS[config.inputResourceId].name;
	return `Need ${bnFormat(cost)} ${inputName} (have ${bnFormat(inputResource.amount)})`;
};

type Props = {
	resource: ResourceState;
};

export const RunButton = ({ resource }: Props) => {
	const { state, startResourceRun } = useGameState();
	const { playClickSfx } = useSfx();
	const { particles, triggerBurst } = useParticleBurst();
	const config = RESOURCE_CONFIGS[resource.id];
	const isRunning = resource.runStartedAt !== null;
	const canRun = canStartRun({ state, resourceId: resource.id });
	const milestone = getSpeedMilestone(resource.producers);
	const [tooltipOpen, setTooltipOpen] = useState(false);
	const insufficientInputMessage = getInsufficientInputMessage({
		state,
		resource,
	});

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (insufficientInputMessage) {
			e.preventDefault();
			setTooltipOpen(true);
			return;
		}
		if (canRun && !isRunning) {
			playClickSfx();

			// Trigger particle burst at click position (relative to button)
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			triggerBurst({ originX: x, originY: y });

			startResourceRun(resource.id);
		}
	};

	const isDisabled = !canRun || isRunning;

	const button = (
		<motion.button
			type="button"
			{...(canRun && !isRunning && { whileTap: { scale: 0.9 } })}
			{...(insufficientInputMessage && {
				onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
			})}
			onClick={handleClick}
			disabled={isDisabled && !insufficientInputMessage}
			aria-disabled={isDisabled}
			className={`relative flex flex-col items-center gap-1 w-24 shrink-0 select-none overflow-visible
				${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
		>
			{/* Particle container */}
			<div className="absolute inset-0 pointer-events-none">
				<ParticleEffect particles={particles} />
			</div>

			<motion.div
				{...(isRunning && {
					animate: { rotate: [0, 5, -5, 0] },
					transition: { repeat: Number.POSITIVE_INFINITY, duration: 0.5 },
				})}
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

	if (!insufficientInputMessage) {
		return button;
	}

	return (
		<Tooltip open={tooltipOpen} onOpenChange={setTooltipOpen}>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="top" sideOffset={8}>
				{insufficientInputMessage}
			</TooltipContent>
		</Tooltip>
	);
};
