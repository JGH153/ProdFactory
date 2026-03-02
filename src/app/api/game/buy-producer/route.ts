import type { NextRequest, NextResponse } from "next/server";
import { buyProducer } from "@/game/producers";
import {
	executeGameAction,
	parseResourceActionBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseResourceActionBody,
		applyAction: buyProducer,
	});
};
