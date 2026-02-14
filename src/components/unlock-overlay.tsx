"use client";

import {
	SquareLock02Icon,
	SquareUnlock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canUnlock } from "@/game/logic";
import type { ResourceId } from "@/game/types";
import { bnFormat } from "@/lib/big-number";

type Props = {
	resourceId: ResourceId;
};

export const UnlockOverlay = ({ resourceId }: Props) => {
	const { state, unlockResourceTier } = useGameState();
	const config = RESOURCE_CONFIGS[resourceId];
	const affordable = canUnlock({ state, resourceId });
	const [isUnlocking, setIsUnlocking] = useState(false);

	const handleUnlock = async () => {
		if (affordable && !isUnlocking) {
			setIsUnlocking(true);
			await unlockResourceTier(resourceId);
			setIsUnlocking(false);
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
			<p className="text-text-muted text-sm mb-3 font-medium">
				{isUnlocking
					? "Unlocking..."
					: affordable
						? "Ready to unlock!"
						: "Locked"}
			</p>
			<Button
				onClick={handleUnlock}
				disabled={!affordable || isUnlocking}
				className={
					affordable && !isUnlocking
						? "bg-accent-amber hover:bg-accent-amber/80 text-primary-foreground font-bold transition-all"
						: "bg-primary/30 text-primary-foreground/50 font-bold"
				}
			>
				{isUnlocking ? (
					<span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
				) : (
					<HugeiconsIcon
						icon={affordable ? SquareUnlock02Icon : SquareLock02Icon}
						size={16}
					/>
				)}
				{isUnlocking ? "Unlocking..." : `Unlock — ${unlockCostText}`}
			</Button>
		</motion.div>
	);
};
