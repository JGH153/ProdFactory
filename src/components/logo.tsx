"use client";

import { motion } from "motion/react";

export const Logo = () => (
	<motion.h1
		className="text-4xl md:text-5xl font-bold tracking-tight mb-8 select-none"
		initial={{ opacity: 0, y: -20 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.6 }}
	>
		<span className="text-primary">Prod</span>
		<span className="text-accent-amber">Factory</span>
	</motion.h1>
);
