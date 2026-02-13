import type { NextRequest, NextResponse } from "next/server";
import { togglePause } from "@/game/logic";
import { executeAction } from "@/lib/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeAction({ request, action: togglePause });
};
