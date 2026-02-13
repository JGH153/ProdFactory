import { NextResponse } from "next/server";
import { buildSessionCookie, createSession } from "@/lib/session";

export const POST = async (): Promise<NextResponse> => {
	const sessionId = await createSession();
	const cookie = buildSessionCookie(sessionId);

	return new NextResponse(null, {
		status: 204,
		headers: { "Set-Cookie": cookie },
	});
};
