"use client";

import { Download01Icon, MicroscopeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ResourceIcon } from "@/components/resource-icon";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { RESOURCE_CONFIGS } from "@/game/config";
import { RESEARCH_CONFIGS } from "@/game/research-config";
import type {
	OfflineResearchLevelUp,
	OfflineSummary,
	ResearchId,
} from "@/game/types";
import { bnFormat } from "@/lib/big-number";

const MAX_OFFLINE_SECONDS = 8 * 3600;

const formatElapsed = (seconds: number): string => {
	if (seconds < 60) {
		return `${Math.floor(seconds)}s`;
	}
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	if (h > 0 && m > 0) {
		return `${h}h ${m}m`;
	}
	if (h > 0) {
		return `${h}h`;
	}
	return `${m}m`;
};

const dedupeResearchLevelUps = (
	levelUps: OfflineResearchLevelUp[],
): OfflineResearchLevelUp[] => {
	const best = new Map<ResearchId, number>();
	for (const { researchId, newLevel } of levelUps) {
		const existing = best.get(researchId);
		if (existing === undefined || newLevel > existing) {
			best.set(researchId, newLevel);
		}
	}
	return Array.from(best, ([researchId, newLevel]) => ({
		researchId,
		newLevel,
	}));
};

type Props = {
	summary: OfflineSummary | null;
	onCollect: () => void;
};

export const OfflineSummaryModal = ({ summary, onCollect }: Props) => {
	const progressPct = summary
		? Math.min((summary.elapsedSeconds / MAX_OFFLINE_SECONDS) * 100, 100)
		: 0;

	const researchLevelUps = summary
		? dedupeResearchLevelUps(summary.researchLevelUps)
		: [];

	return (
		<Dialog open={summary !== null}>
			<DialogContent
				className="max-w-sm"
				onInteractOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<div className="flex flex-col gap-1">
					<DialogTitle>Your factory kept running!</DialogTitle>
					<DialogDescription>
						You were away for{" "}
						{summary ? formatElapsed(summary.elapsedSeconds) : ""}
					</DialogDescription>
				</div>

				<div className="flex flex-col gap-1">
					<Progress
						value={progressPct}
						aria-label="Offline time elapsed"
						className="h-2 bg-border *:data-[slot=progress-indicator]:bg-accent-amber"
					/>
					<div className="flex justify-between text-xs text-text-muted">
						<span>0h</span>
						<span>8h max</span>
					</div>
				</div>

				{summary?.wasCapped && (
					<p className="text-xs text-accent-amber">
						Capped at 8h — upgrade your producers!
					</p>
				)}

				{summary && summary.gains.length > 0 && (
					<ul className="flex flex-col gap-2 my-1">
						{summary.gains.map(({ resourceId, amount }) => (
							<li
								key={resourceId}
								className="flex items-center justify-between text-sm"
							>
								<span className="flex items-center gap-2 text-text-secondary">
									<ResourceIcon resourceId={resourceId} size={16} />
									{RESOURCE_CONFIGS[resourceId].name}
								</span>
								<span className="font-semibold text-accent-amber">
									+{bnFormat(amount)}
								</span>
							</li>
						))}
					</ul>
				)}

				{researchLevelUps.length > 0 && (
					<>
						<p className="text-sm font-semibold text-text-secondary mt-1">
							Research Progress
						</p>
						<ul className="flex flex-col gap-2 my-1">
							{researchLevelUps.map(({ researchId, newLevel }) => (
								<li
									key={researchId}
									className="flex items-center justify-between text-sm"
								>
									<span className="flex items-center gap-2 text-text-secondary">
										<HugeiconsIcon
											icon={MicroscopeIcon}
											size={16}
											className="text-accent-amber"
											aria-hidden="true"
										/>
										{RESEARCH_CONFIGS[researchId].name}
									</span>
									<span className="font-semibold text-accent-amber">
										Level {newLevel}
									</span>
								</li>
							))}
						</ul>
					</>
				)}

				<div className="flex justify-end mt-2">
					<Button onClick={onCollect}>
						<HugeiconsIcon icon={Download01Icon} size={16} aria-hidden="true" />
						Collect
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
