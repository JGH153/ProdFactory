import type { NextRequest, NextResponse } from "next/server";
import { activateBoost } from "@/game/logic";
import { executeBoostAction } from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeBoostAction({ request, action: activateBoost });
};
