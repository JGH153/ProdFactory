"use client";

import { motion } from "motion/react";
import { NewGameButton } from "@/components/new-game-button";

type SettingsPageProps = {
	onReset?: () => void;
};

export const SettingsPage = ({ onReset }: SettingsPageProps) => {
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
					<h3 className="text-sm font-medium text-text-muted mb-2">
						Danger Zone
					</h3>
					<NewGameButton onReset={onReset} />
				</div>
			</div>
		</motion.div>
	);
};
