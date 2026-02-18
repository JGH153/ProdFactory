"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { MUSIC_TRACKS, useMusic } from "@/game/music-context";

export const TrackSelector = () => {
	const { activeTrackId, switchTrack } = useMusic();

	return (
		<div className="flex items-center gap-3">
			<span className="text-sm text-text-secondary shrink-0">Music Track</span>
			<Select value={activeTrackId} onValueChange={switchTrack}>
				<SelectTrigger className="flex-1">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{MUSIC_TRACKS.map((track) => (
						<SelectItem key={track.id} value={track.id}>
							{track.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};
