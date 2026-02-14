"use client";

import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { NewGameButton } from "@/components/new-game-button";
import { ResetShopButton } from "@/components/reset-shop-button";
import { Button } from "@/components/ui/button";

type Props = {
	onReset?: () => void;
	onWatchIntro: () => void;
};

export const SettingsPage = ({ onReset, onWatchIntro }: Props) => {
	return (
		<motion.div
			className="w-full max-w-lg mt-6"
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2 }}
		>
			<h2 className="text-lg font-semibold mb-4">Settings</h2>
			<div className="space-y-4">
				<div>
					<h3 className="text-sm font-medium text-text-muted mb-2">General</h3>
					<Button variant="secondary" onClick={onWatchIntro} className="w-full">
						<HugeiconsIcon icon={PlayCircleIcon} size={20} />
						Watch Intro Video
					</Button>
				</div>
				<div>
					<h3 className="text-sm font-medium text-text-muted mb-2">
						Danger Zone
					</h3>
					<div className="space-y-2">
						<ResetShopButton />
						<NewGameButton onReset={onReset} />
					</div>
				</div>
			</div>
		</motion.div>
	);
};
