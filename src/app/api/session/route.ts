import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { buildSessionCookie, createSession } from "@/lib/server/session";

const MAX_SESSIONS_PER_HOUR = 10;
const ONE_HOUR = 60 * 60;

type CreateSessionResult =
	| { type: "rate_limited" }
	| { type: "created"; cookie: string };

const createNewSession = async (ip: string): Promise<CreateSessionResult> => {
	const { allowed } = await checkRateLimit({
		key: `session:${ip}`,
		maxRequests: MAX_SESSIONS_PER_HOUR,
		windowSeconds: ONE_HOUR,
	});

	if (!allowed) {
		return { type: "rate_limited" };
	}

	const sessionId = await createSession();
	const cookie = buildSessionCookie(sessionId);
	return { type: "created", cookie };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	const ip =
		request.headers.get("x-real-ip")?.trim() ??
		request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
		"unknown";

	const result = await createNewSession(ip);

	if (result.type === "rate_limited") {
		logger.warn({ ip }, "Session creation rate limited");
		return NextResponse.json(
			{ error: "Too many session requests" },
			{ status: 429 },
		);
	}

	return new NextResponse(null, {
		status: 204,
		headers: { "Set-Cookie": result.cookie },
	});
};
