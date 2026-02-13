"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canBuyAutomation } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bnFormat } from "@/lib/big-number";

type Props = {
	resource: ResourceState;
};

export const AutomateButton = ({ resource }: Props) => {
	const { state, buyResourceAutomation, toggleResourcePause } = useGameState();
	const config = RESOURCE_CONFIGS[resource.id];
	const canBuy = canBuyAutomation({ state, resourceId: resource.id });

	if (resource.isAutomated) {
		return (
			<motion.div whileTap={{ scale: 0.95 }}>
				<Button
					variant="outline"
					size="sm"
					onClick={() => toggleResourcePause(resource.id)}
					className={`w-full text-xs border-border bg-card ${
						resource.isPaused
							? "hover:bg-success/20 hover:text-success"
							: "hover:bg-accent-amber/20 hover:text-accent-amber"
					}`}
				>
					{resource.isPaused ? "Resume" : "Pause"}
				</Button>
			</motion.div>
		);
	}

	const handleBuy = () => {
		if (canBuy) {
			buyResourceAutomation(resource.id);
		}
	};

	return (
		<motion.div whileTap={canBuy ? { scale: 0.95 } : undefined}>
			<Button
				variant="outline"
				size="sm"
				onClick={handleBuy}
				disabled={!canBuy}
				className="w-full text-xs border-border bg-card hover:bg-success/20
					hover:text-success disabled:opacity-40"
			>
				Automate — {bnFormat(config.automationCost)} {config.name}
			</Button>
		</motion.div>
	);
};
