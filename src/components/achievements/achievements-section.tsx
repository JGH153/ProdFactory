"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ACHIEVEMENT_CONFIGS,
	ACHIEVEMENT_ORDER,
} from "@/game/achievements/achievement-config";
import { useAchievements } from "@/game/achievements/achievement-context";
import {
	computeAchievementProgress,
	getCompletedCount,
	getTotalRewardPercent,
} from "@/game/achievements/achievement-multiplier";
import { useGameState } from "@/game/state/game-state-context";
import { AchievementCard } from "./achievement-card";

export const AchievementsSection = () => {
	const { achievements } = useAchievements();
	const { state } = useGameState();
	const completedCount = getCompletedCount({ achievements });
	const totalRewardPercent = getTotalRewardPercent({ achievements });

	return (
		<div>
			<h3 className="text-sm font-medium text-text-muted mb-2">Achievements</h3>
			<div className="rounded-lg border border-border bg-card px-3 py-2.5 mb-3">
				<div className="flex items-center gap-2">
					<HugeiconsIcon
						icon={Rocket01Icon}
						size={16}
						className="text-primary"
						aria-hidden="true"
					/>
					<span className="text-sm font-medium text-text-primary">
						{completedCount}/{ACHIEVEMENT_ORDER.length} completed
					</span>
					{totalRewardPercent > 0 && (
						<span className="ml-auto text-sm font-medium text-green-400">
							+{totalRewardPercent}% production
						</span>
					)}
				</div>
			</div>
			<div className="space-y-2">
				{ACHIEVEMENT_ORDER.map((id) => (
					<AchievementCard
						key={id}
						config={ACHIEVEMENT_CONFIGS[id]}
						isCompleted={achievements[id]}
						progress={computeAchievementProgress({
							state,
							achievementId: id,
						})}
					/>
				))}
			</div>
		</div>
	);
};
