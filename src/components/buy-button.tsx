"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { canBuyProducer, getProducerCost } from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bnFormat } from "@/lib/big-number";

type BuyButtonProps = {
	resource: ResourceState;
};

export const BuyButton = ({ resource }: BuyButtonProps) => {
	const { state, buyResourceProducer } = useGameState();
	const config = RESOURCE_CONFIGS[resource.id];
	const cost = getProducerCost(resource.id, resource.producers);
	const canBuy = canBuyProducer(state, resource.id);

	const handleBuy = () => {
		if (canBuy) {
			buyResourceProducer(resource.id);
		}
	};

	return (
		<motion.div whileTap={canBuy ? { scale: 0.95 } : undefined}>
			<Button
				variant="outline"
				size="sm"
				onClick={handleBuy}
				disabled={!canBuy}
				className="w-full text-xs border-border bg-card hover:bg-primary/20
					hover:text-primary disabled:opacity-40"
			>
				Buy x1 — {bnFormat(cost)} {config.name}
			</Button>
		</motion.div>
	);
};
