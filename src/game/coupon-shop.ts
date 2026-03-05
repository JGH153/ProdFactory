import { bigNum, bnGte, bnSub } from "@/lib/big-number";
import type { CouponUpgradeId } from "./coupon-shop-config";
import { COUPON_UPGRADES } from "./coupon-shop-config";
import type { GameState } from "./types";

export const canBuyCouponUpgrade = ({
	state,
	upgradeId,
}: {
	state: GameState;
	upgradeId: CouponUpgradeId;
}): boolean => {
	const upgrade = COUPON_UPGRADES[upgradeId];
	const currentLevel = state.couponUpgrades[upgradeId];
	if (currentLevel >= upgrade.maxLevel) {
		return false;
	}
	return bnGte(state.prestige.couponBalance, bigNum(upgrade.costPerLevel));
};

export const buyCouponUpgrade = ({
	state,
	upgradeId,
}: {
	state: GameState;
	upgradeId: CouponUpgradeId;
}): GameState => {
	if (!canBuyCouponUpgrade({ state, upgradeId })) {
		return state;
	}

	const upgrade = COUPON_UPGRADES[upgradeId];
	return {
		...state,
		couponUpgrades: {
			...state.couponUpgrades,
			[upgradeId]: state.couponUpgrades[upgradeId] + 1,
		},
		prestige: {
			...state.prestige,
			couponBalance: bnSub(
				state.prestige.couponBalance,
				bigNum(upgrade.costPerLevel),
			),
		},
	};
};
