import type { NextRequest, NextResponse } from "next/server";
import { resetResearch } from "@/game/research-logic";
import {
	executeGameAction,
	parseVersionOnlyBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseVersionOnlyBody,
		applyAction: resetResearch,
	});
};
