"use client";

import { Clock01Icon, PlayCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
	getOfflineCapSeconds,
	OFFLINE_PROGRESS_BONUS_PER_LEVEL,
} from "@/game/research-config";
import { useGameState } from "@/game/state/game-state-context";
import { formatHoursMinutes } from "@/lib/format";
import { MusicButton } from "./music-button";
import { NewGameButton } from "./new-game-button";
import { ResetResearchButton } from "./reset-research-button";
import { ResetShopButton } from "./reset-shop-button";
import { SfxButton } from "./sfx-button";
import { TrackSelector } from "./track-selector";

type Props = {
	onReset: () => void;
	onWatchIntro: () => void;
};

export const SettingsPage = ({ onReset, onWatchIntro }: Props) => {
	const { state } = useGameState();
	const maxOfflineSeconds = getOfflineCapSeconds({
		shopBoosts: state.shopBoosts,
		research: state.research,
		offlineCapacityLevel: state.couponUpgrades["offline-capacity"],
	});
	const hasOfflineBoost = state.shopBoosts["offline-2h"];
	const offlineResearchLevel = state.research["offline-progress"];
	const researchBonusMin =
		(offlineResearchLevel * OFFLINE_PROGRESS_BONUS_PER_LEVEL) / 60;

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
					<h3 className="text-sm font-medium text-text-muted mb-2">Audio</h3>
					<div className="space-y-2">
						<MusicButton />
						<TrackSelector />
						<SfxButton />
					</div>
				</div>
				<div>
					<h3 className="text-sm font-medium text-text-muted mb-2">General</h3>
					<Button variant="secondary" onClick={onWatchIntro} className="w-full">
						<HugeiconsIcon icon={PlayCircleIcon} size={20} aria-hidden="true" />
						Watch Intro Video
					</Button>
				</div>
				<div>
					<h3 className="text-sm font-medium text-text-muted mb-2">
						Offline Earnings
					</h3>
					<div className="rounded-lg border border-border bg-card px-3 py-2.5">
						<div className="flex items-center gap-2 mb-1.5">
							<HugeiconsIcon
								icon={Clock01Icon}
								size={16}
								className="text-primary"
								aria-hidden="true"
							/>
							<span className="text-sm font-medium text-text-primary">
								Max: {formatHoursMinutes(maxOfflineSeconds)}
							</span>
						</div>
						<ul className="text-xs text-text-muted space-y-0.5">
							<li>Base: 8h</li>
							{hasOfflineBoost && <li>Shop boost: +2h</li>}
							{researchBonusMin > 0 && <li>Research: +{researchBonusMin}m</li>}
						</ul>
					</div>
				</div>
				<div>
					<h3 className="text-sm font-medium text-text-muted mb-2">
						Danger Zone
					</h3>
					<div className="space-y-2">
						<ResetShopButton />
						<ResetResearchButton />
						<NewGameButton onReset={onReset} />
					</div>
				</div>
			</div>
		</motion.div>
	);
};
