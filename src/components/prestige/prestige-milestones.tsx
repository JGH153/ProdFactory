"use client";

import {
	CheckmarkCircle02Icon,
	SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PRESTIGE_MILESTONES } from "@/game/prestige-config";

type Props = {
	prestigeCount: number;
};

export const PrestigeMilestones = ({ prestigeCount }: Props) => {
	return (
		<div className="flex flex-col gap-3">
			<h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
				Milestones
			</h3>
			<div className="flex flex-col gap-2">
				{PRESTIGE_MILESTONES.map((milestone) => {
					const earned = prestigeCount >= milestone.requiredPrestiges;
					return (
						<div
							key={milestone.id}
							className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
								earned
									? "border-accent-amber/30 bg-accent-amber/5"
									: "border-border bg-card/50 opacity-60"
							}`}
						>
							<HugeiconsIcon
								icon={earned ? CheckmarkCircle02Icon : SquareLock02Icon}
								size={18}
								className={earned ? "text-accent-amber" : "text-text-muted"}
							/>
							<div className="flex-1 min-w-0">
								<p
									className={`text-sm font-medium ${
										earned ? "text-text-primary" : "text-text-muted"
									}`}
								>
									{milestone.name}
								</p>
								<p className="text-xs text-text-muted">
									{milestone.description}
								</p>
								{!earned && (
									<p className="text-xs text-text-muted mt-0.5">
										Requires {milestone.requiredPrestiges}{" "}
										{milestone.requiredPrestiges === 1
											? "prestige"
											: "prestiges"}
									</p>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
