"use client";

import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useRef,
	useState,
} from "react";
import { getAchievementMultiplier } from "./achievement-multiplier";
import {
	loadLocalAchievements,
	saveLocalAchievements,
} from "./achievement-persistence";
import type { AchievementId, AchievementState } from "./achievement-types";
import { createInitialAchievementState } from "./achievement-types";

type AchievementContextValue = {
	achievements: AchievementState;
	achievementMul: number;
	achievementMulRef: React.RefObject<number>;
	updateAchievements: (updated: AchievementState) => void;
	reconcileServerAchievements: (serverAchievements: AchievementState) => void;
};

const AchievementContext = createContext<AchievementContextValue | null>(null);

export const AchievementProvider = ({ children }: PropsWithChildren) => {
	const [achievements, setAchievements] = useState<AchievementState>(
		() => loadLocalAchievements() ?? createInitialAchievementState(),
	);

	const achievementMul = getAchievementMultiplier({ achievements });
	const achievementMulRef = useRef(achievementMul);
	achievementMulRef.current = achievementMul;

	const updateAchievements = useCallback((updated: AchievementState) => {
		setAchievements(updated);
		saveLocalAchievements(updated);
	}, []);

	const reconcileServerAchievements = useCallback(
		(serverAchievements: AchievementState) => {
			setAchievements((current) => {
				// OR-merge: if either side says true, keep true
				let changed = false;
				const merged = { ...current };
				for (const key of Object.keys(merged) as AchievementId[]) {
					if (serverAchievements[key] && !merged[key]) {
						merged[key] = true;
						changed = true;
					}
				}
				if (!changed) {
					return current;
				}
				saveLocalAchievements(merged);
				return merged;
			});
		},
		[],
	);

	return (
		<AchievementContext
			value={{
				achievements,
				achievementMul,
				achievementMulRef,
				updateAchievements,
				reconcileServerAchievements,
			}}
		>
			{children}
		</AchievementContext>
	);
};

export const useAchievements = (): AchievementContextValue => {
	const context = use(AchievementContext);
	if (!context) {
		throw new Error("useAchievements must be used within AchievementProvider");
	}
	return context;
};
