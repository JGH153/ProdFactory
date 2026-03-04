"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { useIsMobile } from "@/lib/use-is-mobile";

type Props = {
	isVisible: boolean;
};

export const GregerPeek = ({ isVisible }: Props) => {
	const prefersReducedMotion = usePrefersReducedMotion();
	const isMobile = useIsMobile();
	const [creditsOpen, setCreditsOpen] = useState(false);

	if (prefersReducedMotion) {
		return null;
	}

	const positionClass = isMobile
		? "absolute right-2 top-0 z-0"
		: "absolute right-0 top-1/2 -translate-y-1/2 z-0";

	const initial = isMobile ? { y: 0, opacity: 0 } : { x: 0, opacity: 0 };
	const animate = isMobile ? { y: -40, opacity: 1 } : { x: 40, opacity: 1 };
	const exit = isMobile ? { y: 0, opacity: 0 } : { x: 0, opacity: 0 };

	return (
		<>
			<AnimatePresence>
				{isVisible && (
					<motion.div
						className={positionClass}
						initial={initial}
						animate={animate}
						exit={exit}
						transition={{ type: "spring", stiffness: 300, damping: 20 }}
					>
						<button
							type="button"
							onClick={() => setCreditsOpen(true)}
							className="cursor-pointer bg-transparent border-none p-0"
							aria-label="Open credits"
						>
							{/* biome-ignore lint/performance/noImgElement: decorative easter egg, no need for next/image optimization */}
							<img
								src="/greger.png"
								alt=""
								className="h-16 w-auto"
								style={isMobile ? undefined : { transform: "rotate(90deg)" }}
							/>
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			<Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
				<DialogContent className="max-w-xs">
					<div className="flex flex-col items-center gap-4">
						<DialogTitle>Credits</DialogTitle>
						<DialogDescription className="text-center">
							Made by Greger & Claude Code
						</DialogDescription>
						{/* biome-ignore lint/performance/noImgElement: credits image, no need for next/image optimization */}
						<img src="/greger.png" alt="Greger" className="h-40 w-auto" />
						<Button variant="outline" onClick={() => setCreditsOpen(false)}>
							Close
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
