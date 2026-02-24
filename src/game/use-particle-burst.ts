"use client";

import { useCallback, useEffect, useState } from "react";
import type { Particle } from "@/lib/particle-generator";
import { generateParticles } from "@/lib/particle-generator";

export const useParticleBurst = () => {
	const [particles, setParticles] = useState<Particle[]>([]);

	const triggerBurst = useCallback(
		({ originX, originY }: { originX: number; originY: number }) => {
			const newParticles = generateParticles({ originX, originY });
			setParticles((prev) => [...prev, ...newParticles]);
		},
		[],
	);

	// Auto-cleanup: remove particles after animation completes.
	// Schedule based on when the oldest particle expires so rapid bursts
	// don't reset the timer and delay cleanup of earlier particles.
	useEffect(() => {
		if (particles.length === 0) {
			return;
		}

		const oldest = Math.min(...particles.map((p) => p.createdAt));
		const delay = Math.max(0, oldest + 600 - Date.now());

		const timerId = setTimeout(() => {
			setParticles((prev) =>
				prev.filter((p) => Date.now() - p.createdAt < 600),
			);
		}, delay);

		return () => clearTimeout(timerId);
	}, [particles]);

	return { particles, triggerBurst };
};
