"use client";

import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
	label: string;
	message: string;
};

export const LockedTab = ({ label, message }: Props) => {
	const [open, setOpen] = useState(false);

	return (
		<Tooltip open={open} onOpenChange={setOpen}>
			<TooltipTrigger asChild>
				<button
					type="button"
					role="tab"
					aria-selected={false}
					aria-disabled
					onClick={() => setOpen((prev) => !prev)}
					className="relative flex flex-col items-center gap-1 px-6 py-2 opacity-50 cursor-not-allowed text-text-muted"
				>
					<HugeiconsIcon icon={SquareLock02Icon} size={24} />
					<span className="text-xs font-medium">{label}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent side="top" sideOffset={8}>
				{message}
			</TooltipContent>
		</Tooltip>
	);
};
