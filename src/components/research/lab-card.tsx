"use client";

import { Cancel01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
	getResearchTime,
	getResearchTimeMultiplier,
	MAX_RESEARCH_LEVEL,
	RESEARCH_CONFIGS,
} from "@/game/research-config";
import { useGameState } from "@/game/state/game-state-context";
import type { LabId } from "@/game/types";

const useResearchProgress = ({
	researchStartedAt,
	levelTimeSeconds,
}: {
	researchStartedAt: number | null;
	levelTimeSeconds: number;
}): { progress: number; remainingSeconds: number } => {
	const [progress, setProgress] = useState(0);
	const rafRef = useRef<number>(0);
	const levelTimeMs = levelTimeSeconds * 1000;

	const tick = useCallback(() => {
		if (researchStartedAt === null) {
			return;
		}
		const elapsed = Date.now() - researchStartedAt;
		const p = Math.min(1, Math.max(0, elapsed / levelTimeMs));
		setProgress(p);
		// Keep running even at p>=1 so the display updates immediately when the
		// game tick advances the research level (changes researchStartedAt).
		rafRef.current = requestAnimationFrame(tick);
	}, [researchStartedAt, levelTimeMs]);

	useEffect(() => {
		if (researchStartedAt === null) {
			setProgress(0);
			return;
		}
		rafRef.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafRef.current);
	}, [researchStartedAt, tick]);

	const remainingSeconds = Math.max(levelTimeSeconds * (1 - progress), 0);
	return { progress, remainingSeconds };
};

type Props = {
	labId: LabId;
	labIndex: number;
	onAssign: () => void;
};

const formatTimeRemaining = (seconds: number): string => {
	if (seconds < 60) {
		return `${Math.ceil(seconds)}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const secs = Math.ceil(seconds % 60);
	if (minutes < 60) {
		return `${minutes}m ${secs}s`;
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
};

export const LabCard = ({ labId, labIndex, onAssign }: Props) => {
	const { state, unlockLab, unassignLabResearch } = useGameState();
	const [isUnlocking, setIsUnlocking] = useState(false);
	const [isCancelling, setIsCancelling] = useState(false);
	const lab = state.labs[labId];

	const activeResearchId = lab.activeResearchId;
	const currentLevel =
		activeResearchId !== null ? state.research[activeResearchId] : 0;
	const rtm = getResearchTimeMultiplier({ shopBoosts: state.shopBoosts });
	const levelTime =
		activeResearchId !== null ? getResearchTime(currentLevel) * rtm : 1;
	const { progress, remainingSeconds } = useResearchProgress({
		researchStartedAt: lab.researchStartedAt,
		levelTimeSeconds: levelTime,
	});

	const handleUnlock = async () => {
		setIsUnlocking(true);
		await unlockLab(labId);
		setIsUnlocking(false);
	};

	const handleCancel = async () => {
		setIsCancelling(true);
		await unassignLabResearch(labId);
		setIsCancelling(false);
	};

	// Locked state
	if (!lab.isUnlocked) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4">
				<div className="text-text-muted">
					<HugeiconsIcon icon={SquareLock02Icon} size={24} aria-hidden="true" />
				</div>
				<span className="text-xs font-semibold text-text-secondary">
					Lab {labIndex}
				</span>
				<Button
					size="sm"
					className="w-full text-xs"
					onClick={handleUnlock}
					disabled={isUnlocking}
				>
					{isUnlocking ? "Unlocking..." : "Unlock (Free)"}
				</Button>
			</div>
		);
	}

	// Idle state
	if (activeResearchId === null || lab.researchStartedAt === null) {
		return (
			<motion.button
				type="button"
				aria-label={`Lab ${labIndex} — Tap to assign research`}
				aria-haspopup="dialog"
				className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-4 cursor-pointer min-h-[120px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				whileTap={{ scale: 0.95 }}
				onClick={onAssign}
			>
				<span className="text-xs font-semibold text-text-secondary">
					Lab {labIndex}
				</span>
				<span className="text-xs text-text-muted">Tap to assign</span>
			</motion.button>
		);
	}

	// Researching state
	const researchConfig = RESEARCH_CONFIGS[activeResearchId];
	const nextLevel = currentLevel + 1;
	const isMaxNext = nextLevel >= MAX_RESEARCH_LEVEL;

	return (
		<div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-card p-4">
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold text-text-secondary">
					Lab {labIndex}
				</span>
				<button
					type="button"
					aria-label="Cancel research"
					className="cursor-pointer text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
					onClick={handleCancel}
					disabled={isCancelling}
				>
					<HugeiconsIcon icon={Cancel01Icon} size={14} aria-hidden="true" />
				</button>
			</div>
			<span className="text-xs font-medium text-text-primary truncate">
				{researchConfig.name}
			</span>
			<span className="text-xs text-text-muted">
				Level {currentLevel} → {isMaxNext ? "MAX" : nextLevel}
			</span>
			<Progress
				value={progress * 100}
				aria-label={`Research progress for ${researchConfig.name}`}
				className="h-2 bg-border [&>[data-slot=progress-indicator]]:bg-accent-amber *:data-[slot=progress-indicator]:transition-none!"
			/>
			<span className="text-xs text-text-muted">
				{formatTimeRemaining(remainingSeconds)} /{" "}
				{formatTimeRemaining(levelTime)}
			</span>
		</div>
	);
};
