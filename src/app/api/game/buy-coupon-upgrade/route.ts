import type { NextRequest, NextResponse } from "next/server";
import { buyCouponUpgrade } from "@/game/coupon-shop";
import {
	executeGameAction,
	parseCouponUpgradeActionBody,
} from "@/lib/server/api-helpers";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	return executeGameAction({
		request,
		parseBody: parseCouponUpgradeActionBody,
		applyAction: buyCouponUpgrade,
	});
};
