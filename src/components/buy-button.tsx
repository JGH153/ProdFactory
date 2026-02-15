"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { RESOURCE_CONFIGS } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import {
	canBuyProducer,
	getMaxAffordableProducers,
	getProducerCost,
} from "@/game/logic";
import type { ResourceState } from "@/game/types";
import { bnFormat } from "@/lib/big-number";

type Props = {
	resource: ResourceState;
};

export const BuyButton = ({ resource }: Props) => {
	const { state, buyResourceProducer, buyMaxResourceProducers } =
		useGameState();
	const config = RESOURCE_CONFIGS[resource.id];
	const cost = getProducerCost({
		resourceId: resource.id,
		owned: resource.producers,
	});
	const canBuy = canBuyProducer({ state, resourceId: resource.id });
	const maxAffordable = getMaxAffordableProducers({
		state,
		resourceId: resource.id,
	});

	const handleBuy = () => {
		if (canBuy) {
			buyResourceProducer(resource.id);
		}
	};

	const handleBuyMax = () => {
		if (maxAffordable > 0) {
			buyMaxResourceProducers(resource.id);
		}
	};

	return (
		<div className="flex gap-1">
			<motion.div
				className="flex-1"
				{...(canBuy && { whileTap: { scale: 0.95 } })}
			>
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
			<motion.div {...(maxAffordable > 0 && { whileTap: { scale: 0.95 } })}>
				<Button
					variant="outline"
					size="sm"
					onClick={handleBuyMax}
					disabled={maxAffordable === 0}
					className="text-xs border-border bg-card hover:bg-primary/20
						hover:text-primary disabled:opacity-40"
				>
					Max{maxAffordable > 0 ? ` (${maxAffordable})` : ""}
				</Button>
			</motion.div>
		</div>
	);
};
