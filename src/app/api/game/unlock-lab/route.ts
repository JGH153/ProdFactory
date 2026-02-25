import type { NextRequest, NextResponse } from "next/server";
import { unlockLab } from "@/game/research-logic";
import { executeLabAction } from "@/lib/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeLabAction({ request, action: unlockLab });
};
