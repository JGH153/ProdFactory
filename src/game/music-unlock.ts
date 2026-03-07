import type { CouponUpgradeId } from "./coupon-shop-config";
import type { MusicTrackId } from "./state/music-context";

const TRACK_UPGRADE_MAP: Partial<Record<MusicTrackId, CouponUpgradeId>> = {
	gemini: "music-gemini",
	"gemini-calm": "music-gemini-calm",
	classic: "music-classic",
};

export const isTrackUnlocked = ({
	trackId,
	couponUpgrades,
}: {
	trackId: MusicTrackId;
	couponUpgrades: Record<CouponUpgradeId, number>;
}): boolean => {
	const upgradeId = TRACK_UPGRADE_MAP[trackId];
	if (!upgradeId) {
		return true;
	}
	return couponUpgrades[upgradeId] >= 1;
};
