"use client";

import {
	Cancel01Icon,
	CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { COUPON_BONUS_PER_UNIT } from "@/game/prestige-config";
import type { BigNum } from "@/lib/big-number";
import { bnAdd, bnFormat, bnToNumber } from "@/lib/big-number";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	couponsToEarn: BigNum;
	currentLifetimeCoupons: BigNum;
	isPrestiging: boolean;
	onConfirm: () => void;
};

const KEEPS = ["Research levels", "Lab unlocks", "Shop boosts", "Coupons"];
const LOSES = ["Resources", "Producers", "Automation", "Tier unlocks"];

export const PrestigeConfirmModal = ({
	open,
	onOpenChange,
	couponsToEarn,
	currentLifetimeCoupons,
	isPrestiging,
	onConfirm,
}: Props) => {
	const newLifetime = bnAdd(currentLifetimeCoupons, couponsToEarn);
	const newBonusPercent = Math.round(
		bnToNumber(newLifetime) * COUPON_BONUS_PER_UNIT * 100,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-w-sm"
				onInteractOutside={(e) => {
					if (isPrestiging) {
						e.preventDefault();
					}
				}}
				onEscapeKeyDown={(e) => {
					if (isPrestiging) {
						e.preventDefault();
					}
				}}
			>
				<div className="flex flex-col gap-4">
					<div>
						<DialogTitle className="text-lg font-semibold text-text-primary">
							FICSIT Evaluation
						</DialogTitle>
						<DialogDescription className="text-sm text-text-muted">
							Ready to prestige and earn coupons?
						</DialogDescription>
					</div>

					<div className="flex flex-col gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/5 p-3">
						<div className="flex items-center justify-between text-sm">
							<span className="text-text-muted">Coupons to earn</span>
							<span className="font-semibold text-accent-amber">
								+{bnFormat(couponsToEarn)}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-text-muted">New lifetime total</span>
							<span className="font-medium text-text-primary">
								{bnFormat(newLifetime)}
							</span>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span className="text-text-muted">New passive bonus</span>
							<span className="font-medium text-text-primary">
								+{newBonusPercent.toLocaleString("en-US")}%
							</span>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1.5">
							<p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
								You keep
							</p>
							{KEEPS.map((item) => (
								<div
									key={item}
									className="flex items-center gap-1.5 text-sm text-text-primary"
								>
									<HugeiconsIcon
										icon={CheckmarkCircle02Icon}
										size={14}
										className="text-green-500 shrink-0"
										aria-hidden="true"
									/>
									{item}
								</div>
							))}
						</div>
						<div className="flex flex-col gap-1.5">
							<p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
								You lose
							</p>
							{LOSES.map((item) => (
								<div
									key={item}
									className="flex items-center gap-1.5 text-sm text-text-muted"
								>
									<HugeiconsIcon
										icon={Cancel01Icon}
										size={14}
										className="text-red-400 shrink-0"
										aria-hidden="true"
									/>
									{item}
								</div>
							))}
						</div>
					</div>

					<div className="flex gap-2 pt-1">
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => onOpenChange(false)}
							disabled={isPrestiging}
						>
							Keep Playing
						</Button>
						<Button
							className="flex-1"
							onClick={onConfirm}
							disabled={isPrestiging}
						>
							{isPrestiging ? "Prestiging..." : "Prestige Now"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
