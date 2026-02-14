import type { NextRequest, NextResponse } from "next/server";
import { resetShopBoosts } from "@/game/logic";
import { executeSimpleAction } from "@/lib/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeSimpleAction({ request, action: resetShopBoosts });
};
