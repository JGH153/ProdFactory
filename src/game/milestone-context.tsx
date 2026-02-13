"use client";

import { AnimatePresence, motion } from "motion/react";
import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useRef,
	useState,
} from "react";
import { ResourceIcon } from "@/components/resource-icon";
import { RESOURCE_CONFIGS } from "./config";
import type { ResourceId } from "./types";

type MilestoneNotification = {
	resourceId: ResourceId;
	multiplier: number;
};

type MilestoneContextValue = {
	showMilestone: (resourceId: ResourceId, multiplier: number) => void;
};

const MilestoneContext = createContext<MilestoneContextValue | null>(null);

const DISMISS_DELAY = 5000;

export const MilestoneNotificationProvider = ({
	children,
}: PropsWithChildren) => {
	const [queue, setQueue] = useState<MilestoneNotification[]>([]);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const dismissCurrent = useCallback(() => {
		setQueue((prev) => prev.slice(1));
		timerRef.current = null;
	}, []);

	const scheduleAutoDismiss = useCallback(() => {
		if (timerRef.current !== null) {
			return;
		}
		timerRef.current = setTimeout(dismissCurrent, DISMISS_DELAY);
	}, [dismissCurrent]);

	const showMilestone = useCallback(
		(resourceId: ResourceId, multiplier: number) => {
			setQueue((prev) => [...prev, { resourceId, multiplier }]);
		},
		[],
	);

	const current = queue[0] ?? null;

	if (current && timerRef.current === null) {
		scheduleAutoDismiss();
	}

	return (
		<MilestoneContext value={{ showMilestone }}>
			{children}
			<div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2">
				<AnimatePresence mode="wait">
					{current && (
						<motion.div
							key={`${current.resourceId}-${current.multiplier}`}
							initial={{ y: 100, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: 100, opacity: 0 }}
							transition={{
								type: "spring",
								stiffness: 500,
								damping: 30,
							}}
							className="flex items-center gap-5 rounded-xl border border-border bg-card px-8 py-6 shadow-lg"
						>
							<ResourceIcon resourceId={current.resourceId} size={48} />
							<span className="text-xl font-bold text-text-primary">
								{RESOURCE_CONFIGS[current.resourceId].name} speed is{" "}
								{current.multiplier}x now!
							</span>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</MilestoneContext>
	);
};

export const useMilestoneNotification = (): MilestoneContextValue => {
	const context = use(MilestoneContext);
	if (!context) {
		throw new Error(
			"useMilestoneNotification must be used within MilestoneNotificationProvider",
		);
	}
	return context;
};
