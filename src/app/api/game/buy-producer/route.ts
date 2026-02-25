import type { NextRequest, NextResponse } from "next/server";
import { buyProducer } from "@/game/logic";
import { executeAction } from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeAction({ request, action: buyProducer });
};
