"use client";

import { MicroscopeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
import { RESOURCE_CONFIGS } from "@/game/config";
import type { ResearchId, ResourceId } from "@/game/types";
import { bigNum, bnFormat } from "@/lib/big-number";
import { usePrefersReducedMotion } from "@/lib/prefers-reduced-motion";
import { useSfx } from "./sfx-context";

type SpeedMilestonePayload = {
	kind: "speed";
	resourceId: ResourceId;
	multiplier: number;
};

type ResearchLevelUpPayload = {
	kind: "research";
	researchId: ResearchId;
	researchName: string;
	newLevel: number;
	bonusPercent: number;
};

type NotificationPayload = SpeedMilestonePayload | ResearchLevelUpPayload;

type GameNotification = {
	id: number;
	payload: NotificationPayload;
};

type NavigateTab = "game" | "research";

type MilestoneContextValue = {
	showMilestone: (args: { resourceId: ResourceId; multiplier: number }) => void;
	showResearchLevelUp: (args: {
		researchId: ResearchId;
		researchName: string;
		newLevel: number;
		bonusPercent: number;
	}) => void;
	registerNavigate: (fn: (tab: NavigateTab) => void) => void;
};

const MilestoneContext = createContext<MilestoneContextValue | null>(null);

const DISMISS_DELAY = 5000;
const MAX_VISIBLE = 3;
const EXIT_ANIMATION_MS = 500;

export const MilestoneNotificationProvider = ({
	children,
}: PropsWithChildren) => {
	const [queue, setQueue] = useState<GameNotification[]>([]);
	const [exitingCount, setExitingCount] = useState(0);
	const nextIdRef = useRef(0);
	const timerMapRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
		new Map(),
	);
	const seenIdsRef = useRef<Set<number>>(new Set());
	const navigateRef = useRef<((tab: NavigateTab) => void) | null>(null);
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
			const payload: SpeedMilestonePayload = {
				kind: "speed",
				resourceId,
				multiplier,
			};
			setQueue((prev) => [...prev, { id, payload }]);
		},
		[],
	);

	const showResearchLevelUp = useCallback(
		({
			researchId,
			researchName,
			newLevel,
			bonusPercent,
		}: {
			researchId: ResearchId;
			researchName: string;
			newLevel: number;
			bonusPercent: number;
		}) => {
			const id = nextIdRef.current++;
			const payload: ResearchLevelUpPayload = {
				kind: "research",
				researchId,
				researchName,
				newLevel,
				bonusPercent,
			};
			setQueue((prev) => {
				const isDuplicate = prev.some(
					(n) =>
						n.payload.kind === "research" &&
						n.payload.researchId === researchId &&
						n.payload.newLevel === newLevel,
				);
				if (isDuplicate) {
					return prev;
				}
				return [...prev, { id, payload }];
			});
		},
		[],
	);

	const registerNavigate = useCallback((fn: (tab: NavigateTab) => void) => {
		navigateRef.current = fn;
	}, []);

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

	const handleClick = useCallback(
		(item: GameNotification) => {
			if (item.payload.kind === "speed") {
				navigateRef.current?.("game");
			} else {
				navigateRef.current?.("research");
			}
			dismissById(item.id);
		},
		[dismissById],
	);

	return (
		<MilestoneContext
			value={{ showMilestone, showResearchLevelUp, registerNavigate }}
		>
			{children}
			<div
				className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
				role="log"
				aria-live="polite"
				aria-label="Game notifications"
			>
				<AnimatePresence>
					{visible.map((item) => (
						<motion.div
							key={item.id}
							layout
							initial={{ y: -100, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -100, opacity: 0 }}
							transition={{
								type: "spring",
								stiffness: 500,
								damping: 30,
							}}
							onClick={() => handleClick(item)}
							onKeyDown={(e: React.KeyboardEvent) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									handleClick(item);
								}
							}}
							role="button"
							tabIndex={0}
							className="flex cursor-pointer items-center gap-5 rounded-xl border border-border bg-card px-8 py-6 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{item.payload.kind === "speed" ? (
								<SpeedMilestoneContent payload={item.payload} />
							) : (
								<ResearchLevelUpContent payload={item.payload} />
							)}
						</motion.div>
					))}
				</AnimatePresence>
			</div>
		</MilestoneContext>
	);
};

const WiggleSpan = ({ children }: PropsWithChildren) => {
	const prefersReducedMotion = usePrefersReducedMotion();
	return (
		<motion.span
			className="inline-block text-accent-amber"
			{...(!prefersReducedMotion && {
				animate: { x: [0, -3, 3, -3, 3, -2, 2, 0] },
				transition: { duration: 0.5, ease: "easeInOut" },
			})}
		>
			{children}
		</motion.span>
	);
};

const SpeedMilestoneContent = ({
	payload,
}: {
	payload: SpeedMilestonePayload;
}) => {
	const formatted = bnFormat(bigNum(payload.multiplier));
	const multiplierText = /\d$/.test(formatted)
		? `${formatted}x`
		: `${formatted} x`;

	return (
		<>
			<ResourceIcon resourceId={payload.resourceId} size={48} />
			<span className="text-xl font-bold text-text-primary">
				{RESOURCE_CONFIGS[payload.resourceId].name} speed is{" "}
				<WiggleSpan>{multiplierText}</WiggleSpan> now!
			</span>
		</>
	);
};

const ResearchLevelUpContent = ({
	payload,
}: {
	payload: ResearchLevelUpPayload;
}) => (
	<>
		<HugeiconsIcon
			icon={MicroscopeIcon}
			size={48}
			className="text-accent-amber shrink-0"
			aria-hidden="true"
		/>
		<span className="text-xl font-bold text-text-primary">
			{payload.researchName} level {payload.newLevel} —{" "}
			<WiggleSpan>+{payload.bonusPercent}%</WiggleSpan>{" "}
			{payload.researchId.startsWith("speed-") ? "speed" : "bonus"}!
		</span>
	</>
);

export const useMilestoneNotification = (): MilestoneContextValue => {
	const context = use(MilestoneContext);
	if (!context) {
		throw new Error(
			"useMilestoneNotification must be used within MilestoneNotificationProvider",
		);
	}
	return context;
};
