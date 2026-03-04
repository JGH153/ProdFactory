"use client";

import { Clock01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { ResourceIcon } from "@/components/resource-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
	EFFICIENCY_RESEARCH_ORDER,
	getMaxLevelForResearch,
	getResearchTime,
	getResearchTimeMultiplier,
	LAB_ORDER,
	OFFLINE_PROGRESS_BONUS_PER_LEVEL,
	RESEARCH_BONUS_PER_LEVEL,
	RESEARCH_CONFIGS,
	SPEED_RESEARCH_ORDER,
	UTILITY_RESEARCH_ORDER,
} from "@/game/research-config";
import { useGameState } from "@/game/state/game-state-context";
import type { GameState, LabId, ResearchId } from "@/game/types";

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

type BonusDisplay = {
	current: string;
	next: string;
	complete: string;
};

const getUtilityBonusDisplay = ({
	level,
	nextLevel,
	maxLevel,
}: {
	level: number;
	nextLevel: number;
	maxLevel: number;
}): BonusDisplay => {
	const currentMin = (level * OFFLINE_PROGRESS_BONUS_PER_LEVEL) / 60;
	const nextMin = (nextLevel * OFFLINE_PROGRESS_BONUS_PER_LEVEL) / 60;
	const maxMin = (maxLevel * OFFLINE_PROGRESS_BONUS_PER_LEVEL) / 60;
	return {
		current: `+${currentMin}m offline`,
		next: `+${nextMin}m offline`,
		complete: `Complete (+${maxMin}m offline)`,
	};
};

const getPercentBonusDisplay = ({
	level,
	nextLevel,
	maxLevel,
	isSpeedResearch,
}: {
	level: number;
	nextLevel: number;
	maxLevel: number;
	isSpeedResearch: boolean;
}): BonusDisplay => {
	const currentBonus = Math.round(level * RESEARCH_BONUS_PER_LEVEL * 100);
	const nextBonus = Math.round(nextLevel * RESEARCH_BONUS_PER_LEVEL * 100);
	const completeBonus = Math.round(maxLevel * RESEARCH_BONUS_PER_LEVEL * 100);
	const suffix = isSpeedResearch ? " speed" : "";
	return {
		current: `+${currentBonus}%${suffix}`,
		next: `+${nextBonus}%${suffix}`,
		complete: `Complete (+${completeBonus}%${suffix})`,
	};
};

type ItemProps = {
	researchId: ResearchId;
	labId: LabId;
	state: GameState;
	assigningId: ResearchId | null;
	researchTimeMultiplier: number;
	onSelect: (researchId: ResearchId) => void;
};

const ResearchPickerItem = ({
	researchId,
	labId,
	state,
	assigningId,
	researchTimeMultiplier,
	onSelect,
}: ItemProps) => {
	const config = RESEARCH_CONFIGS[researchId];
	const level = state.research[researchId];
	const maxLevel = getMaxLevelForResearch(researchId);
	const isMaxed = level >= maxLevel;
	const isUtility = config.resourceId === null;
	const isLocked =
		config.resourceId === null
			? state.prestige.prestigeCount < 1
			: !state.resources[config.resourceId].isUnlocked;
	const isAssignedElsewhere = LAB_ORDER.some(
		(otherLabId) =>
			otherLabId !== labId &&
			state.labs[otherLabId].activeResearchId === researchId,
	);
	const isDisabled = isMaxed || isLocked || isAssignedElsewhere;
	const isAssigning = assigningId === researchId;
	const isSpeedResearch = researchId.startsWith("speed-");
	const nextLevel = level + 1;
	const timeForNext = getResearchTime(level) * researchTimeMultiplier;

	const bonusDisplay = isUtility
		? getUtilityBonusDisplay({ level, nextLevel, maxLevel })
		: getPercentBonusDisplay({ level, nextLevel, maxLevel, isSpeedResearch });

	return (
		<button
			key={researchId}
			type="button"
			className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 text-left transition-colors cursor-pointer hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			disabled={isDisabled || assigningId !== null}
			onClick={() => onSelect(researchId)}
		>
			{config.resourceId === null ? (
				<HugeiconsIcon
					icon={Clock01Icon}
					size={20}
					className="text-primary shrink-0"
					aria-hidden="true"
				/>
			) : (
				<ResourceIcon resourceId={config.resourceId} size={20} />
			)}
			<div className="flex flex-col gap-0.5 flex-1 min-w-0">
				<span className="text-xs font-medium text-text-primary truncate">
					{config.name}
				</span>
				{isMaxed ? (
					<span className="text-xs text-success">{bonusDisplay.complete}</span>
				) : (
					<span className="text-xs text-text-muted">
						{bonusDisplay.current} → {bonusDisplay.next}
						<span className="ml-1.5 text-text-muted/70">
							({formatDuration(timeForNext)})
						</span>
					</span>
				)}
			</div>
			{isAssigning && <Spinner className="border-primary shrink-0" />}
			{isLocked && (
				<span className="text-xs text-text-muted shrink-0">Locked</span>
			)}
			{isAssignedElsewhere && !isMaxed && !isLocked && (
				<span className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
					<Spinner className="size-3 border-text-muted" />
					In use
				</span>
			)}
		</button>
	);
};

export const ResearchPickerDialog = ({ labId, open, onOpenChange }: Props) => {
	const { state, assignLabResearch } = useGameState();
	const [assigningId, setAssigningId] = useState<ResearchId | null>(null);
	const researchTimeMultiplier = getResearchTimeMultiplier({
		shopBoosts: state.shopBoosts,
	});

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
					<HugeiconsIcon
						icon={InformationCircleIcon}
						size={16}
						aria-hidden="true"
					/>
					<AlertDescription>
						Unlock a resource in the game to research its efficiency or speed.
					</AlertDescription>
				</Alert>
				<div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
					<h4 className="text-xs font-semibold text-text-secondary">
						Efficiency
					</h4>
					<ul className="flex flex-col gap-3">
						{EFFICIENCY_RESEARCH_ORDER.map((researchId) => (
							<li key={researchId}>
								<ResearchPickerItem
									researchId={researchId}
									labId={labId}
									state={state}
									assigningId={assigningId}
									researchTimeMultiplier={researchTimeMultiplier}
									onSelect={handleSelect}
								/>
							</li>
						))}
					</ul>
					<h4 className="text-xs font-semibold text-text-secondary mt-2">
						Speed
					</h4>
					<ul className="flex flex-col gap-3">
						{SPEED_RESEARCH_ORDER.map((researchId) => (
							<li key={researchId}>
								<ResearchPickerItem
									researchId={researchId}
									labId={labId}
									state={state}
									assigningId={assigningId}
									researchTimeMultiplier={researchTimeMultiplier}
									onSelect={handleSelect}
								/>
							</li>
						))}
					</ul>
					<h4 className="text-xs font-semibold text-text-secondary mt-2">
						Utility
					</h4>
					<ul className="flex flex-col gap-3">
						{UTILITY_RESEARCH_ORDER.map((researchId) => (
							<li key={researchId}>
								<ResearchPickerItem
									researchId={researchId}
									labId={labId}
									state={state}
									assigningId={assigningId}
									researchTimeMultiplier={researchTimeMultiplier}
									onSelect={handleSelect}
								/>
							</li>
						))}
					</ul>
				</div>
			</DialogContent>
		</Dialog>
	);
};
