"use client";

import { motion } from "motion/react";
import { ResourceCard } from "@/components/resource/resource-card";
import { RESOURCE_ORDER } from "@/game/config";
import { useGameState } from "@/game/state/game-state-context";

export const GameBoard = () => {
	const { state } = useGameState();

	return (
		<>
			<h2 className="sr-only">Factory</h2>
			<motion.ul
				className="w-full max-w-lg flex flex-col gap-4"
				initial="hidden"
				animate="visible"
				variants={{
					hidden: {},
					visible: { transition: { staggerChildren: 0.15 } },
				}}
			>
				{RESOURCE_ORDER.map((resourceId) => (
					<li key={resourceId}>
						<ResourceCard resource={state.resources[resourceId]} />
					</li>
				))}
			</motion.ul>
		</>
	);
};
