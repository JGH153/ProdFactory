import type { NextRequest, NextResponse } from "next/server";
import { unlockLab } from "@/game/research-logic";
import {
	executeGameAction,
	parseLabActionBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseLabActionBody,
		applyAction: unlockLab,
	});
};
