"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AchievementConfig } from "@/game/achievements/achievement-types";

type Props = {
	config: AchievementConfig;
	isCompleted: boolean;
	progress: { current: number; target: number; fraction: number };
};

export const AchievementCard = ({ config, isCompleted, progress }: Props) => (
	<div
		className={`rounded-lg border px-3 py-2.5 ${
			isCompleted
				? "border-green-600/50 bg-green-950/20"
				: "border-border bg-card"
		}`}
	>
		<div className="flex items-center gap-2 mb-1">
			<HugeiconsIcon
				icon={Rocket01Icon}
				size={16}
				className={isCompleted ? "text-green-400" : "text-text-muted"}
				aria-hidden="true"
			/>
			<span
				className={`text-sm font-medium ${
					isCompleted ? "text-green-400" : "text-text-primary"
				}`}
			>
				{config.name}
			</span>
			<span className="ml-auto text-xs text-text-muted">
				+{config.rewardPercent}%
			</span>
		</div>
		<p className="text-xs text-text-muted mb-1.5">{config.description}</p>
		{!isCompleted && (
			<div className="flex items-center gap-2">
				<div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
					<div
						className="h-full rounded-full bg-primary transition-all duration-300"
						style={{ width: `${Math.round(progress.fraction * 100)}%` }}
					/>
				</div>
				<span className="text-xs text-text-muted tabular-nums">
					{Math.round(progress.fraction * 100)}%
				</span>
			</div>
		)}
	</div>
);
