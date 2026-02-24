"use client";

import { Download01Icon } from "@hugeicons/core-free-icons";
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
import type { OfflineSummary } from "@/game/types";
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

type Props = {
	summary: OfflineSummary | null;
	onCollect: () => void;
};

export const OfflineSummaryModal = ({ summary, onCollect }: Props) => {
	const progressPct = summary
		? Math.min((summary.elapsedSeconds / MAX_OFFLINE_SECONDS) * 100, 100)
		: 0;

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

				<ul className="flex flex-col gap-2 my-1">
					{summary?.gains.map(({ resourceId, amount }) => (
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

				<div className="flex justify-end mt-2">
					<Button onClick={onCollect}>
						<HugeiconsIcon icon={Download01Icon} size={16} />
						Collect
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
