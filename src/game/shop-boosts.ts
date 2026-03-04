import type { GameState, ShopBoostId } from "./types";

export const activateBoost = ({
	state,
	boostId,
}: {
	state: GameState;
	boostId: ShopBoostId;
}): GameState => {
	if (state.shopBoosts[boostId]) {
		return state;
	}
	return {
		...state,
		shopBoosts: { ...state.shopBoosts, [boostId]: true },
	};
};

export const resetShopBoosts = ({ state }: { state: GameState }): GameState => {
	const hasActiveBoost = Object.values(state.shopBoosts).some(Boolean);
	if (!hasActiveBoost) {
		return state;
	}
	return {
		...state,
		shopBoosts: {
			"production-20x": false,
			"automation-2x": false,
			"runtime-50": false,
			"research-2x": false,
			"offline-2h": false,
		},
	};
};
