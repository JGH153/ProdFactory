"use client";

import { motion } from "motion/react";
import { RESOURCE_ORDER } from "@/game/config";
import { useGameState } from "@/game/game-state-context";
import { ResourceCard } from "./resource-card";

export const GameBoard = () => {
	const { state } = useGameState();

	return (
		<motion.div
			className="w-full max-w-lg flex flex-col gap-4"
			initial="hidden"
			animate="visible"
			variants={{
				hidden: {},
				visible: { transition: { staggerChildren: 0.15 } },
			}}
		>
			{RESOURCE_ORDER.map((resourceId) => (
				<ResourceCard key={resourceId} resource={state.resources[resourceId]} />
			))}
		</motion.div>
	);
};
