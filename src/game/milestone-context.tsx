"use client";

import { AnimatePresence, motion } from "motion/react";
import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { ResourceIcon } from "@/components/resource-icon";
import { RESOURCE_CONFIGS } from "./config";
import { useSfx } from "./sfx-context";
import type { ResourceId } from "./types";

type MilestoneNotification = {
	id: number;
	resourceId: ResourceId;
	multiplier: number;
};

type MilestoneContextValue = {
	showMilestone: (args: { resourceId: ResourceId; multiplier: number }) => void;
};

const MilestoneContext = createContext<MilestoneContextValue | null>(null);

const DISMISS_DELAY = 5000;
const MAX_VISIBLE = 3;
const EXIT_ANIMATION_MS = 500;

export const MilestoneNotificationProvider = ({
	children,
}: PropsWithChildren) => {
	const [queue, setQueue] = useState<MilestoneNotification[]>([]);
	const [exitingCount, setExitingCount] = useState(0);
	const nextIdRef = useRef(0);
	const timerMapRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	const seenIdsRef = useRef<Set<number>>(new Set());
	const { playMilestoneSfx } = useSfx();

	const dismissById = useCallback((id: number) => {
		setExitingCount((c) => c + 1);
		setQueue((prev) => prev.filter((n) => n.id !== id));
		timerMapRef.current.delete(id);
		seenIdsRef.current.delete(id);
		setTimeout(() => {
			setExitingCount((c) => c - 1);
		}, EXIT_ANIMATION_MS);
	}, []);

	const showMilestone = useCallback(
		({
			resourceId,
			multiplier,
		}: {
			resourceId: ResourceId;
			multiplier: number;
		}) => {
			const id = nextIdRef.current++;
			setQueue((prev) => [...prev, { id, resourceId, multiplier }]);
		},
		[],
	);

	const visible = queue.slice(0, MAX_VISIBLE - exitingCount);

	useEffect(() => {
		for (const item of visible) {
			if (!seenIdsRef.current.has(item.id)) {
				seenIdsRef.current.add(item.id);
				playMilestoneSfx();
				timerMapRef.current.set(
					item.id,
					setTimeout(() => dismissById(item.id), DISMISS_DELAY),
				);
			}
		}
	}, [visible, playMilestoneSfx, dismissById]);

	useEffect(() => {
		const timers = timerMapRef.current;
		return () => {
			for (const timer of timers.values()) {
				clearTimeout(timer);
			}
		};
	}, []);

	return (
		<MilestoneContext value={{ showMilestone }}>
			{children}
			<div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col-reverse gap-2">
				<AnimatePresence>
					{visible.map((item) => (
						<motion.div
							key={item.id}
							layout
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
							<ResourceIcon resourceId={item.resourceId} size={48} />
							<span className="text-xl font-bold text-text-primary">
								{RESOURCE_CONFIGS[item.resourceId].name} speed is{" "}
								<motion.span
									className="inline-block text-accent-amber"
									animate={{
										x: [0, -3, 3, -3, 3, -2, 2, 0],
									}}
									transition={{
										duration: 0.5,
										ease: "easeInOut",
									}}
								>
									{item.multiplier}x
								</motion.span>{" "}
								now!
							</span>
						</motion.div>
					))}
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
