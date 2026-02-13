"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canUnlock } from "@/game/logic";
import type { ResourceId } from "@/game/types";
import { bnFormat } from "@/lib/big-number";

type UnlockOverlayProps = {
	resourceId: ResourceId;
};

export const UnlockOverlay = ({ resourceId }: UnlockOverlayProps) => {
	const { state, unlockResourceTier } = useGameState();
	const config = RESOURCE_CONFIGS[resourceId];
	const affordable = canUnlock({ state, resourceId });

	const handleUnlock = () => {
		if (affordable) {
			unlockResourceTier(resourceId);
		}
	};

	const unlockCostText =
		config.unlockCost && config.unlockCostResourceId
			? `${bnFormat(config.unlockCost)} ${RESOURCE_CONFIGS[config.unlockCostResourceId].name}`
			: "Free";

	return (
		<motion.div
			className="absolute inset-0 flex flex-col items-center justify-center
				bg-background/80 backdrop-blur-sm z-10 rounded-xl"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0, scale: 1.05 }}
			transition={{ duration: 0.3 }}
		>
			<p className="text-text-muted text-sm mb-3 font-medium">Locked</p>
			<Button
				onClick={handleUnlock}
				disabled={!affordable}
				className="bg-primary hover:bg-primary-hover text-primary-foreground font-bold
					disabled:opacity-40"
			>
				Unlock — {unlockCostText}
			</Button>
		</motion.div>
	);
};
