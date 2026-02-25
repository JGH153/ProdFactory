"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { ResourceIcon } from "@/components/resource-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useGameState } from "@/game/game-state-context";
import {
	getResearchTime,
	getResearchTimeMultiplier,
	LAB_ORDER,
	MAX_RESEARCH_LEVEL,
	RESEARCH_BONUS_PER_LEVEL,
	RESEARCH_CONFIGS,
	RESEARCH_ORDER,
} from "@/game/research-config";
import type { LabId, ResearchId } from "@/game/types";

type Props = {
	labId: LabId;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const formatDuration = (seconds: number): string => {
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (minutes < 60) {
		return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

export const ResearchPickerDialog = ({ labId, open, onOpenChange }: Props) => {
	const { state, assignLabResearch } = useGameState();
	const [assigningId, setAssigningId] = useState<ResearchId | null>(null);
	const rtm = getResearchTimeMultiplier({ shopBoosts: state.shopBoosts });

	const handleSelect = async (researchId: ResearchId) => {
		setAssigningId(researchId);
		const success = await assignLabResearch({ labId, researchId });
		setAssigningId(null);
		if (success) {
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm" aria-describedby={undefined}>
				<DialogTitle>Choose Research</DialogTitle>
				<Alert className="mb-2">
					<HugeiconsIcon icon={InformationCircleIcon} size={16} />
					<AlertDescription>
						Unlock a resource in the game to research its efficiency.
					</AlertDescription>
				</Alert>
				<div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
					{RESEARCH_ORDER.map((researchId) => {
						const config = RESEARCH_CONFIGS[researchId];
						const level = state.research[researchId];
						const isMaxed = level >= MAX_RESEARCH_LEVEL;
						const isLocked = !state.resources[config.resourceId].isUnlocked;
						const isAssignedElsewhere = LAB_ORDER.some(
							(otherLabId) =>
								otherLabId !== labId &&
								state.labs[otherLabId].activeResearchId === researchId,
						);
						const isDisabled = isMaxed || isLocked || isAssignedElsewhere;
						const isAssigning = assigningId === researchId;
						const nextLevel = level + 1;
						const currentBonus = Math.round(
							level * RESEARCH_BONUS_PER_LEVEL * 100,
						);
						const nextBonus = Math.round(
							nextLevel * RESEARCH_BONUS_PER_LEVEL * 100,
						);
						const timeForNext = getResearchTime(level) * rtm;

						return (
							<button
								key={researchId}
								type="button"
								className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
								disabled={isDisabled || assigningId !== null}
								onClick={() => handleSelect(researchId)}
							>
								<ResourceIcon resourceId={config.resourceId} size={20} />
								<div className="flex flex-col gap-0.5 flex-1 min-w-0">
									<span className="text-xs font-medium text-text-primary truncate">
										{config.name}
									</span>
									{isMaxed ? (
										<span className="text-xs text-success">
											Complete (+100%)
										</span>
									) : (
										<span className="text-xs text-text-muted">
											+{currentBonus}% → +{nextBonus}%
											<span className="ml-1.5 text-text-muted/70">
												({formatDuration(timeForNext)})
											</span>
										</span>
									)}
								</div>
								{isAssigning && (
									<span className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
								)}
								{isLocked && (
									<span className="text-xs text-text-muted shrink-0">
										Locked
									</span>
								)}
								{isAssignedElsewhere && !isMaxed && !isLocked && (
									<span className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
										<span className="size-3 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
										In use
									</span>
								)}
							</button>
						);
					})}
				</div>
			</DialogContent>
		</Dialog>
	);
};
