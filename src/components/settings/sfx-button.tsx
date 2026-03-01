"use client";

import { VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { useMuteShortcut } from "@/game/hooks/use-mute-shortcut";
import { useSfx } from "@/game/state/sfx-context";

export const SfxButton = () => {
	const { sfxEnabled, toggleSfx } = useSfx();

	useMuteShortcut(toggleSfx);

	return (
		<Button variant="secondary" onClick={toggleSfx} className="w-full">
			<HugeiconsIcon
				icon={sfxEnabled ? VolumeHighIcon : VolumeOffIcon}
				size={20}
				aria-hidden="true"
			/>
			{sfxEnabled ? "Mute SFX" : "Unmute SFX"}
		</Button>
	);
};
