"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { canBuyCouponUpgrade } from "@/game/coupon-shop";
import type { CouponUpgradeId } from "@/game/coupon-shop-config";
import {
	COUPON_UPGRADE_ORDER,
	COUPON_UPGRADES,
} from "@/game/coupon-shop-config";
import { useGameState } from "@/game/state/game-state-context";
import { bnFormat } from "@/lib/big-number";

export const CouponShop = () => {
	const { state, buyCouponUpgrade } = useGameState();
	const [busyId, setBusyId] = useState<CouponUpgradeId | null>(null);
	const [successId, setSuccessId] = useState<CouponUpgradeId | null>(null);
	const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

	const handleBuy = async (upgradeId: CouponUpgradeId) => {
		setBusyId(upgradeId);
		const ok = await buyCouponUpgrade(upgradeId);
		setBusyId(null);
		if (ok) {
			if (successTimerRef.current) {
				clearTimeout(successTimerRef.current);
			}
			setSuccessId(upgradeId);
			successTimerRef.current = setTimeout(() => setSuccessId(null), 1000);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
				Coupon Shop
			</h3>
			<p className="text-xs text-text-muted">
				Spend coupons on permanent upgrades. Balance:{" "}
				<span className="font-semibold text-accent-amber">
					{bnFormat(state.prestige.couponBalance)}
				</span>
			</p>
			<ul className="flex flex-col gap-2">
				{COUPON_UPGRADE_ORDER.map((id) => {
					const upgrade = COUPON_UPGRADES[id];
					const currentLevel = state.couponUpgrades[id];
					const isMaxed = currentLevel >= upgrade.maxLevel;
					const canAfford = canBuyCouponUpgrade({
						state,
						upgradeId: id,
					});

					return (
						<li
							key={id}
							className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors duration-500 ${
								isMaxed
									? "border-accent-amber/30 bg-accent-amber/5"
									: successId === id
										? "border-success/50 bg-success/10"
										: "border-border bg-card/50"
							}`}
						>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-text-primary">
									{upgrade.name}
								</p>
								<p className="text-xs text-text-muted">{upgrade.description}</p>
								<p className="text-xs text-text-muted mt-0.5">
									Level {currentLevel} / {upgrade.maxLevel}
								</p>
							</div>
							<Button
								size="sm"
								variant={isMaxed ? "outline" : "default"}
								disabled={!canAfford || isMaxed || busyId !== null}
								onClick={() => handleBuy(id)}
							>
								{isMaxed
									? "MAX"
									: busyId === id
										? "..."
										: `${upgrade.costPerLevel} Coupons`}
							</Button>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
