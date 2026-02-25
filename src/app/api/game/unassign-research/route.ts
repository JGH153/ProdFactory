import type { NextRequest, NextResponse } from "next/server";
import { unassignResearch } from "@/game/research-logic";
import { executeLabAction } from "@/lib/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeLabAction({ request, action: unassignResearch });
};
