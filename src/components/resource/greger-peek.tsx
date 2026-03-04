"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { useIsMobile } from "@/lib/use-is-mobile";

type Props = {
	isVisible: boolean;
};

export const GregerPeek = ({ isVisible }: Props) => {
	const prefersReducedMotion = usePrefersReducedMotion();
	const isMobile = useIsMobile();

	if (prefersReducedMotion) {
		return null;
	}

	const positionClass = isMobile
		? "absolute right-2 top-0 z-0 pointer-events-none"
		: "absolute right-0 top-1/2 -translate-y-1/2 z-0 pointer-events-none";

	const initial = isMobile ? { y: 0, opacity: 0 } : { x: 0, opacity: 0 };
	const animate = isMobile ? { y: -40, opacity: 1 } : { x: 40, opacity: 1 };
	const exit = isMobile ? { y: 0, opacity: 0 } : { x: 0, opacity: 0 };

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					className={positionClass}
					initial={initial}
					animate={animate}
					exit={exit}
					transition={{ type: "spring", stiffness: 300, damping: 20 }}
					aria-hidden="true"
				>
					{/* biome-ignore lint/performance/noImgElement: decorative easter egg, no need for next/image optimization */}
					<img
						src="/greger.png"
						alt=""
						className="h-16 w-auto"
						style={isMobile ? undefined : { transform: "rotate(90deg)" }}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
};
