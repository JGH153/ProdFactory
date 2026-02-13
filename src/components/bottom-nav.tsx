"use client";

import {
	GameController01Icon,
	Settings01Icon,
	SquareLock02Icon,
	Store01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGameState } from "@/game/game-state-context";
import type { ResourceId } from "@/game/types";

type BottomNavTab = "game" | "shop" | "settings";

type TabConfig = {
	id: BottomNavTab;
	label: string;
	icon: IconSvgElement;
	requiresUnlock?: {
		resourceId: ResourceId;
		message: string;
	};
};

const TABS: TabConfig[] = [
	{ id: "game", label: "Game", icon: GameController01Icon },
	{
		id: "shop",
		label: "Shop",
		icon: Store01Icon,
		requiresUnlock: {
			resourceId: "plates",
			message: "Unlock Plates to access the Shop",
		},
	},
	{ id: "settings", label: "Settings", icon: Settings01Icon },
];

type LockedTabProps = {
	label: string;
	message: string;
};

const LockedTab = ({ label, message }: LockedTabProps) => {
	const [open, setOpen] = useState(false);

	return (
		<Tooltip open={open} onOpenChange={setOpen}>
			<TooltipTrigger asChild>
				<button
					type="button"
					role="tab"
					aria-selected={false}
					aria-disabled
					onClick={() => setOpen((prev) => !prev)}
					className="relative flex flex-col items-center gap-1 px-6 py-2 opacity-50 cursor-not-allowed text-text-muted"
				>
					<HugeiconsIcon icon={SquareLock02Icon} size={24} />
					<span className="text-xs font-medium">{label}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={8}>
				{message}
			</TooltipContent>
		</Tooltip>
	);
};

type BottomNavProps = {
	activeTab: BottomNavTab;
	onTabChange: (tab: BottomNavTab) => void;
};

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
	const { state } = useGameState();

	return (
		<motion.nav
			className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm"
			initial={{ y: 60 }}
			animate={{ y: 0 }}
			transition={{ duration: 0.3 }}
			role="tablist"
		>
			<div className="flex items-center justify-around max-w-lg mx-auto h-16">
				{TABS.map((tab) => {
					const isActive = activeTab === tab.id;
					const { requiresUnlock } = tab;
					const isLocked =
						requiresUnlock !== undefined &&
						!state.resources[requiresUnlock.resourceId].isUnlocked;

					if (isLocked && requiresUnlock) {
						return (
							<LockedTab
								key={tab.id}
								label={tab.label}
								message={requiresUnlock.message}
							/>
						);
					}

					return (
						<motion.button
							key={tab.id}
							type="button"
							role="tab"
							aria-selected={isActive}
							onClick={() => onTabChange(tab.id)}
							whileTap={{ scale: 0.9 }}
							className={`relative flex flex-col items-center gap-1 px-6 py-2 cursor-pointer ${
								isActive ? "text-primary" : "text-text-muted"
							}`}
						>
							{isActive && (
								<motion.div
									layoutId="active-tab-indicator"
									className="absolute -top-px left-2 right-2 h-0.5 bg-primary rounded-full"
									transition={{
										type: "spring",
										stiffness: 500,
										damping: 30,
									}}
								/>
							)}
							<HugeiconsIcon icon={tab.icon} size={24} />
							<span className="text-xs font-medium">{tab.label}</span>
						</motion.button>
					);
				})}
			</div>
		</motion.nav>
	);
};
