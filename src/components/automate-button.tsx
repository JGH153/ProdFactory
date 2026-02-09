"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canBuyAutomation } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bnFormat } from "@/lib/big-number";

type AutomateButtonProps = {
	resource: ResourceState;
};

export const AutomateButton = ({ resource }: AutomateButtonProps) => {
	const { state, buyResourceAutomation } = useGameState();
	const config = RESOURCE_CONFIGS[resource.id];
	const canBuy = canBuyAutomation(state, resource.id);

	if (resource.isAutomated) {
		return (
			<span className="text-xs text-success text-center font-medium">
				Automated
			</span>
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
