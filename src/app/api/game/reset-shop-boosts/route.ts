import type { NextRequest, NextResponse } from "next/server";
import { resetShopBoosts } from "@/game/logic";
import { executeSimpleAction } from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeSimpleAction({ request, action: resetShopBoosts });
};
