"use client";

import {
	GemIcon,
	GridIcon,
	Layers01Icon,
	Shield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ResourceId } from "@/game/types";

type ResourceIconProps = {
	resourceId: ResourceId;
	size?: number;
};

const ICON_MAP = {
	"iron-ore": GemIcon,
	plates: Layers01Icon,
	"reinforced-plate": Shield01Icon,
	"modular-frame": GridIcon,
} as const;

const COLOR_MAP: Record<ResourceId, string> = {
	"iron-ore": "var(--color-iron)",
	plates: "var(--color-plate)",
	"reinforced-plate": "var(--color-reinforced-plate)",
	"modular-frame": "var(--color-modular-frame)",
};

export const ResourceIcon = ({ resourceId, size = 32 }: ResourceIconProps) => (
	<HugeiconsIcon
		icon={ICON_MAP[resourceId]}
		size={size}
		color={COLOR_MAP[resourceId]}
		strokeWidth={1.5}
	/>
);
