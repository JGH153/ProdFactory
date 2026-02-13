"use client";

import { GameController01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";

type BottomNavTab = "game" | "shop";

type BottomNavProps = {
	activeTab: BottomNavTab;
	onTabChange: (tab: BottomNavTab) => void;
};

const TABS = [
	{ id: "game" as const, label: "Game", icon: GameController01Icon },
	{ id: "shop" as const, label: "Shop", icon: Store01Icon },
];

export const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
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
