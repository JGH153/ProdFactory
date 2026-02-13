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
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={toggleSfx}
			title={sfxEnabled ? "Mute sound effects (M)" : "Unmute sound effects (M)"}
			className="text-text-muted hover:text-primary"
		>
			<HugeiconsIcon
				icon={sfxEnabled ? VolumeHighIcon : VolumeOffIcon}
				size={20}
			/>
		</Button>
	);
};
