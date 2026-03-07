"use client";

import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ResourceIcon } from "@/components/resource-icon";
import {
	getMaxLevelForResearch,
	LAB_ORDER,
	OFFLINE_PROGRESS_BONUS_PER_LEVEL,
	RESEARCH_BONUS_PER_LEVEL,
	RESEARCH_CONFIGS,
	type ResearchConfig,
} from "@/game/research-config";
import { useGameState } from "@/game/state/game-state-context";
import type { LabId, ResearchId } from "@/game/types";

type Props = {
	researchId: ResearchId;
};

const getLabLabel = (labId: LabId): string => {
	return labId === "lab-1" ? "Lab 1" : "Lab 2";
};

const getActiveLabForResearch = ({
	researchId,
	labs,
}: {
	researchId: ResearchId;
	labs: Record<LabId, { activeResearchId: ResearchId | null }>;
}): LabId | null => {
	for (const labId of LAB_ORDER) {
		if (labs[labId].activeResearchId === researchId) {
			return labId;
		}
	}
	return null;
};

const formatBonusMinutes = (level: number): string => {
	const minutes = (level * OFFLINE_PROGRESS_BONUS_PER_LEVEL) / 60;
	return `+${minutes}m offline`;
};

const formatPercentBonus = ({
	level,
	isSpeedResearch,
}: {
	level: number;
	isSpeedResearch: boolean;
}): string | null => {
	const bonus = Math.round(level * RESEARCH_BONUS_PER_LEVEL * 100);
	if (bonus <= 0) {
		return null;
	}
	return `+${bonus}%${isSpeedResearch ? " speed" : ""}`;
};

export const ResearchItemCard = ({ researchId }: Props) => {
	const { state } = useGameState();
	const config: ResearchConfig = RESEARCH_CONFIGS[researchId];
	const level = state.research[researchId];
	const maxLevel = getMaxLevelForResearch(researchId);
	const isMaxed = level >= maxLevel;
	const isUtility = config.resourceId === null;
	const isLocked =
		config.resourceId === null
			? state.prestige.prestigeCount < 1
			: !state.resources[config.resourceId].isUnlocked &&
				state.prestige.prestigeCount < 1;
	const isSpeedResearch = researchId.startsWith("speed-");
	const activeLab = getActiveLabForResearch({
		researchId,
		labs: state.labs,
	});

	const bonusLabel = isUtility
		? level > 0
			? formatBonusMinutes(level)
			: null
		: formatPercentBonus({ level, isSpeedResearch });

	return (
		<div
			className={`flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5${isLocked ? " opacity-40" : ""}`}
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
				<span className="text-xs text-text-muted">
					Level {level}/{maxLevel}
					{bonusLabel !== null && (
						<span className="text-accent-amber ml-1.5">{bonusLabel}</span>
					)}
				</span>
			</div>
			<div className="shrink-0">
				{isLocked ? (
					<span className="text-xs font-medium text-text-muted">Locked</span>
				) : isMaxed ? (
					<span className="text-xs font-medium text-success">Complete</span>
				) : activeLab !== null ? (
					<span className="text-xs font-medium text-accent-amber">
						{getLabLabel(activeLab)}
					</span>
				) : null}
			</div>
		</div>
	);
};
