"use client";

import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { isTrackUnlocked } from "@/game/music-unlock";
import { useGameState } from "@/game/state/game-state-context";
import { MUSIC_TRACKS, useMusic } from "@/game/state/music-context";

export const TrackSelector = () => {
	const { activeTrackId, switchTrack } = useMusic();
	const { state } = useGameState();

	useEffect(() => {
		if (
			!isTrackUnlocked({
				trackId: activeTrackId,
				couponUpgrades: state.couponUpgrades,
			})
		) {
			switchTrack("cave");
		}
	}, [activeTrackId, state.couponUpgrades, switchTrack]);

	return (
		<div className="flex items-center gap-3">
			<span
				id="music-track-label"
				className="text-sm text-text-secondary shrink-0"
			>
				Music Track
			</span>
			<Select value={activeTrackId} onValueChange={switchTrack}>
				<SelectTrigger className="flex-1" aria-labelledby="music-track-label">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{MUSIC_TRACKS.map((track) => {
						const locked = !isTrackUnlocked({
							trackId: track.id,
							couponUpgrades: state.couponUpgrades,
						});
						return (
							<SelectItem key={track.id} value={track.id} disabled={locked}>
								<span className="flex items-center gap-1.5">
									{track.label}
									{locked && (
										<HugeiconsIcon
											icon={SquareLock02Icon}
											size={14}
											aria-hidden="true"
											className="text-text-muted"
										/>
									)}
								</span>
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>
		</div>
	);
};
