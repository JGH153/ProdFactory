import type { NextRequest, NextResponse } from "next/server";
import { assignResearch } from "@/game/research-logic";
import {
	executeGameAction,
	parseLabResearchActionBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseLabResearchActionBody,
		applyAction: assignResearch,
	});
};
