"use client";

import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { RESOURCE_ORDER } from "@/game/config";
import {
	getSpeedResearchMultiplier,
	RESEARCH_BONUS_PER_LEVEL,
	RESEARCH_CONFIGS,
} from "@/game/research-config";
import {
	advanceResearchWithReport,
	type ResearchLevelUp,
} from "@/game/research-logic";
import { getClampedRunTime, getRunTimeMultiplier } from "@/game/run-timing";
import { canStartRun, completeRun, isRunComplete, startRun } from "@/game/runs";
import type { GameState, ResearchId } from "@/game/types";

type ShowResearchLevelUp = (args: {
	researchId: ResearchId;
	researchName: string;
	newLevel: number;
	bonusPercent: number;
}) => void;

export const useGameLoop = ({
	setState,
	showResearchLevelUp,
	achievementMulRef,
}: {
	setState: Dispatch<SetStateAction<GameState>>;
	showResearchLevelUp: ShowResearchLevelUp;
	achievementMulRef: React.RefObject<number>;
}) => {
	const pendingLevelUpsRef = useRef<ResearchLevelUp[]>([]);

	useEffect(() => {
		let rafId: number;

		const tick = () => {
			setState((current) => {
				let next = current;
				let changed = false;

				for (const resourceId of RESOURCE_ORDER) {
					const resource = next.resources[resourceId];
					const runTimeMultiplier = getRunTimeMultiplier({
						shopBoosts: next.shopBoosts,
						isAutomated: resource.isAutomated && !resource.isPaused,
						speedResearchMultiplier: getSpeedResearchMultiplier({
							research: next.research,
							resourceId,
						}),
						speedSurgeLevel: next.couponUpgrades["speed-surge"],
					});

					if (
						isRunComplete({
							resource,
							runTime: getClampedRunTime({
								resourceId,
								producers: resource.producers,
								runTimeMultiplier,
							}),
						})
					) {
						next = completeRun({
							state: next,
							resourceId,
							achievementMul: achievementMulRef.current,
						});
						changed = true;
					}

					// Auto-start runs for automated resources that are idle and not paused
					const updated = next.resources[resourceId];
					if (
						updated.isAutomated &&
						!updated.isPaused &&
						updated.runStartedAt === null &&
						canStartRun({ state: next, resourceId })
					) {
						next = startRun({ state: next, resourceId });
						changed = true;
					}
				}

				const researchResult = advanceResearchWithReport({
					state: next,
					now: Date.now(),
				});
				if (researchResult.state !== next) {
					next = researchResult.state;
					changed = true;
					pendingLevelUpsRef.current.push(...researchResult.levelUps);
				}

				return changed ? next : current;
			});

			// Dispatch research level-up notifications outside setState
			if (pendingLevelUpsRef.current.length > 0) {
				// Deduplicate: if a single tick jumped multiple levels for the same
				// research, only show the highest level reached.
				const best = new Map<ResearchId, number>();
				for (const { researchId, newLevel } of pendingLevelUpsRef.current) {
					const existing = best.get(researchId);
					if (existing === undefined || newLevel > existing) {
						best.set(researchId, newLevel);
					}
				}
				pendingLevelUpsRef.current = [];
				for (const [researchId, newLevel] of best) {
					const config = RESEARCH_CONFIGS[researchId];
					showResearchLevelUp({
						researchId,
						researchName: config.name,
						newLevel,
						bonusPercent: Math.round(newLevel * RESEARCH_BONUS_PER_LEVEL * 100),
					});
				}
			}

			rafId = requestAnimationFrame(tick);
		};

		rafId = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafId);
	}, [setState, showResearchLevelUp, achievementMulRef]);
};
