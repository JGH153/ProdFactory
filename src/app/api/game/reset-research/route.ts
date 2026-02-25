import type { NextRequest, NextResponse } from "next/server";
import { resetResearch } from "@/game/research-logic";
import { executeSimpleAction } from "@/lib/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeSimpleAction({ request, action: resetResearch });
};
