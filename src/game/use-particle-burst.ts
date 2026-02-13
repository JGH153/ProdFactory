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

	// Auto-cleanup: remove particles after animation completes
	useEffect(() => {
		if (particles.length === 0) {
			return;
		}

		const timerId = setTimeout(() => {
			setParticles((prev) =>
				prev.filter((p) => Date.now() - p.createdAt < 600),
			);
		}, 600);

		return () => clearTimeout(timerId);
	}, [particles]);

	return { particles, triggerBurst };
};
