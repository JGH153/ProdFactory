"use client";

import { ResourceIcon } from "@/components/resource-icon";
import {
	LAB_ORDER,
	MAX_RESEARCH_LEVEL,
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

export const ResearchItemCard = ({ researchId }: Props) => {
	const { state } = useGameState();
	const config: ResearchConfig = RESEARCH_CONFIGS[researchId];
	const level = state.research[researchId];
	const isMaxed = level >= MAX_RESEARCH_LEVEL;
	const isLocked = !state.resources[config.resourceId].isUnlocked;
	const bonus = Math.round(level * RESEARCH_BONUS_PER_LEVEL * 100);
	const activeLab = getActiveLabForResearch({
		researchId,
		labs: state.labs,
	});

	return (
		<div
			className={`flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5${isLocked ? " opacity-40" : ""}`}
		>
			<ResourceIcon resourceId={config.resourceId} size={20} />
			<div className="flex flex-col gap-0.5 flex-1 min-w-0">
				<span className="text-xs font-medium text-text-primary truncate">
					{config.name}
				</span>
				<span className="text-xs text-text-muted">
					Level {level}/{MAX_RESEARCH_LEVEL}
					{bonus > 0 && (
						<span className="text-accent-amber ml-1.5">+{bonus}%</span>
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
