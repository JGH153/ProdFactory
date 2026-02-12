export type Particle = {
	id: string;
	x: number;
	y: number;
	velocityX: number;
	velocityY: number;
	size: number;
	color: string;
	rotation: number;
	duration: number;
	createdAt: number;
};

const COLORS = ["#fa9549", "#f5a623", "#e8842e"] as const;

export const generateParticles = (
	originX: number,
	originY: number,
): Particle[] => {
	const count = 6 + Math.floor(Math.random() * 3); // 6-8 particles

	return Array.from({ length: count }, (_, i) => {
		// Distribute particles evenly around a circle with random jitter
		const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
		const velocity = 100 + Math.random() * 50; // 100-150px distance

		return {
			id: `${Date.now()}-${i}-${Math.random()}`,
			x: originX,
			y: originY,
			velocityX: Math.cos(angle) * velocity,
			velocityY: Math.sin(angle) * velocity - 50, // Upward bias
			size: 4 + Math.random() * 4, // 4-8px
			color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? COLORS[0],
			rotation: Math.random() * 360,
			duration: 0.4 + Math.random() * 0.2, // 0.4-0.6s
			createdAt: Date.now(),
		};
	});
};
