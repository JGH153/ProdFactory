import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildSessionCookie, createSession } from "@/lib/session";

const MAX_SESSIONS_PER_HOUR = 10;
const ONE_HOUR = 60 * 60;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const ip =
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

	const { allowed } = await checkRateLimit({
		key: `session:${ip}`,
		maxRequests: MAX_SESSIONS_PER_HOUR,
		windowSeconds: ONE_HOUR,
	});

	if (!allowed) {
		return NextResponse.json(
			{ error: "Too many session requests" },
			{ status: 429 },
		);
	}

	const sessionId = await createSession();
	const cookie = buildSessionCookie(sessionId);

	return new NextResponse(null, {
		status: 204,
		headers: { "Set-Cookie": cookie },
	});
};
