"use client";

import { VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useSfx } from "@/game/sfx-context";
import { useMuteShortcut } from "@/game/use-mute-shortcut";

export const SfxButton = () => {
	const { sfxEnabled, toggleSfx } = useSfx();

	useMuteShortcut(toggleSfx);

	return (
		<Button variant="secondary" onClick={toggleSfx} className="w-full">
			<HugeiconsIcon
				icon={sfxEnabled ? VolumeHighIcon : VolumeOffIcon}
				size={20}
			/>
			{sfxEnabled ? "Mute SFX" : "Unmute SFX"}
		</Button>
	);
};
