"use client";

import {
	AtomicPowerIcon,
	GemIcon,
	GridIcon,
	Layers01Icon,
	Shield01Icon,
	WeightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ResourceId } from "@/game/types";

type Props = {
	resourceId: ResourceId;
	size?: number;
};

const ICON_MAP = {
	"iron-ore": GemIcon,
	plates: Layers01Icon,
	"reinforced-plate": Shield01Icon,
	"modular-frame": GridIcon,
	"heavy-modular-frame": WeightIcon,
	"fused-modular-frame": AtomicPowerIcon,
} as const;

const COLOR_MAP: Record<ResourceId, string> = {
	"iron-ore": "var(--color-iron)",
	plates: "var(--color-plate)",
	"reinforced-plate": "var(--color-reinforced-plate)",
	"modular-frame": "var(--color-modular-frame)",
	"heavy-modular-frame": "var(--color-heavy-modular-frame)",
	"fused-modular-frame": "var(--color-fused-modular-frame)",
};

export const ResourceIcon = ({ resourceId, size = 32 }: Props) => (
	<HugeiconsIcon
		icon={ICON_MAP[resourceId]}
		size={size}
		color={COLOR_MAP[resourceId]}
		strokeWidth={1.5}
	/>
);
