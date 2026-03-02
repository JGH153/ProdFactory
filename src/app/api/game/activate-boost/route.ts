import type { NextRequest, NextResponse } from "next/server";
import { advanceResearch } from "@/game/research-logic";
import { activateBoost } from "@/game/shop-boosts";
import {
	executeGameAction,
	parseBoostActionBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseBoostActionBody,
		applyAction: activateBoost,
		afterApply: ({ state }) => advanceResearch({ state, now: Date.now() }),
	});
};
