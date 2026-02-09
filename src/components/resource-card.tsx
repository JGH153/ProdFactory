"use client";

import { AnimatePresence, motion } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { RESOURCE_CONFIGS } from "@/game/config";
import { getRunInputCost } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bnFormat } from "@/lib/big-number";
import { AutomateButton } from "./automate-button";
import { BuyButton } from "./buy-button";
import { ProgressBar } from "./progress-bar";
import { RunButton } from "./run-button";
import { UnlockOverlay } from "./unlock-overlay";

type ResourceCardProps = {
	resource: ResourceState;
};

export const ResourceCard = ({ resource }: ResourceCardProps) => {
	const config = RESOURCE_CONFIGS[resource.id];
	const isLocked = !resource.isUnlocked;
	const inputCost = getRunInputCost(resource.id, resource.producers);

	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, y: 20 },
				visible: { opacity: 1, y: 0 },
			}}
		>
			<Card
				className={`relative overflow-hidden border-border bg-card select-none
					${isLocked ? "opacity-50" : ""}`}
			>
				<CardContent className="flex items-center gap-4 p-4">
					{/* LEFT: Icon + Name + Count (clickable to start run) */}
					<RunButton resource={resource} />

					{/* RIGHT: Progress bar + info + Buy button */}
					<div className="flex-1 flex flex-col gap-2">
						<ProgressBar resource={resource} />

						{inputCost && config.inputResourceId && (
							<span className="text-xs text-text-muted">
								Cost: {bnFormat(inputCost)}{" "}
								{RESOURCE_CONFIGS[config.inputResourceId].name}
							</span>
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
