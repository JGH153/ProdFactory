"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Particle } from "@/lib/particle-generator";

type Props = {
	particles: Particle[];
};

export const ParticleEffect = ({ particles }: Props) => {
	return (
		<AnimatePresence>
			{particles.map((particle) => (
				<motion.div
					key={particle.id}
					className="absolute pointer-events-none rounded-sm"
					style={{
						width: particle.size,
						height: particle.size,
						backgroundColor: particle.color,
						left: particle.x,
						top: particle.y,
					}}
					initial={{ opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 }}
					animate={{
						x: particle.velocityX,
						y: particle.velocityY,
						opacity: 0,
						scale: 0.3,
						rotate: particle.rotation,
					}}
					exit={{ opacity: 0 }}
					transition={{
						duration: particle.duration,
						ease: "easeOut",
					}}
				/>
			))}
		</AnimatePresence>
	);
};
