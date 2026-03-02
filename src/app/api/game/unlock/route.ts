import type { NextRequest, NextResponse } from "next/server";
import { unlockResource } from "@/game/unlocking";
import {
	executeGameAction,
	parseResourceActionBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseResourceActionBody,
		applyAction: unlockResource,
	});
};
