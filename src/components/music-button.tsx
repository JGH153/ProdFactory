"use client";

import { MusicNote03Icon, VolumeMute02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useMusic } from "@/game/music-context";
import { useMuteShortcut } from "@/game/use-mute-shortcut";

export const MusicButton = () => {
	const { isPlaying, toggle } = useMusic();

	useMuteShortcut(toggle);

	return (
		<Button variant="secondary" onClick={toggle} className="w-full">
			<HugeiconsIcon
				icon={isPlaying ? MusicNote03Icon : VolumeMute02Icon}
				size={20}
			/>
			{isPlaying ? "Pause Music" : "Play Music"}
		</Button>
	);
};
