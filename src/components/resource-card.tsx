"use client";

import { AnimatePresence, motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { RESOURCE_CONFIGS } from "@/game/config";
import { getEffectiveRunTime, getRunInputCost } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bigNum, bnFormat, bnMul } from "@/lib/big-number";
import { AutomateButton } from "./automate-button";
import { BuyButton } from "./buy-button";
import { ProgressBar } from "./progress-bar";
import { RunButton } from "./run-button";
import { UnlockOverlay } from "./unlock-overlay";

type Props = {
	resource: ResourceState;
};

export const ResourceCard = ({ resource }: Props) => {
	const config = RESOURCE_CONFIGS[resource.id];
	const isLocked = !resource.isUnlocked;
	const inputCost = getRunInputCost({
		resourceId: resource.id,
		producers: resource.producers,
	});
	const isAutomatedActive = resource.isAutomated && !resource.isPaused;
	const inputCostPerSecond =
		isAutomatedActive && config.inputCostPerRun
			? bnMul(
					config.inputCostPerRun,
					bigNum(
						resource.producers /
							getEffectiveRunTime({
								resourceId: resource.id,
								producers: resource.producers,
							}),
					),
				)
			: null;

	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, y: 20 },
				visible: { opacity: 1, y: 0 },
			}}
		>
			<Card
				className={`relative border-border bg-card select-none
					${isLocked ? "opacity-50" : ""}`}
			>
				<CardContent className="flex items-center gap-4 p-4">
					{/* LEFT: Icon + Name + Count (clickable to start run) */}
					<RunButton resource={resource} />

					{/* RIGHT: Progress bar + info + Buy button */}
					<div className="flex-1 flex flex-col gap-2">
						<ProgressBar resource={resource} />

						{config.inputResourceId && inputCostPerSecond ? (
							<span className="text-xs text-text-muted">
								Cost: {bnFormat(inputCostPerSecond)}{" "}
								{RESOURCE_CONFIGS[config.inputResourceId].name}/s
							</span>
						) : (
							inputCost &&
							config.inputResourceId && (
								<span className="text-xs text-text-muted">
									Cost: {bnFormat(inputCost)}{" "}
									{RESOURCE_CONFIGS[config.inputResourceId].name}
								</span>
							)
						)}

						<BuyButton resource={resource} />
						<AutomateButton resource={resource} />
					</div>
				</CardContent>

				{/* Overlay for locked resources */}
				<AnimatePresence>
					{isLocked && <UnlockOverlay resourceId={resource.id} />}
				</AnimatePresence>
			</Card>
		</motion.div>
	);
};
