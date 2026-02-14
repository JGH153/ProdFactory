import { getSessionData, type SessionData, setSessionData } from "./redis";

export const COOKIE_NAME = "pf-session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const createSession = async (): Promise<string> => {
	const sessionId = crypto.randomUUID();
	const data: SessionData = {
		createdAt: Date.now(),
		lastActiveAt: Date.now(),
		warnings: 0,
	};
	await setSessionData({ sessionId, data });
	return sessionId;
};

export const validateSession = async (
	sessionId: string,
): Promise<SessionData | null> => {
	const data = await getSessionData(sessionId);
	if (!data) {
		return null;
	}
	const updated: SessionData = {
		...data,
		lastActiveAt: Date.now(),
	};
	await setSessionData({ sessionId, data: updated });
	return updated;
};

export const incrementWarnings = async (sessionId: string): Promise<number> => {
	const data = await getSessionData(sessionId);
	if (!data) {
		return 0;
	}
	console.warn(
		"Incrementing warnings for session",
		sessionId,
		"current count:",
		data.warnings,
	);
	const newCount = data.warnings + 1;
	const updated: SessionData = {
		...data,
		warnings: newCount,
		lastActiveAt: Date.now(),
	};
	await setSessionData({ sessionId, data: updated });
	return newCount;
};

export const resetWarnings = async (sessionId: string): Promise<void> => {
	const data = await getSessionData(sessionId);
	if (!data) {
		return;
	}
	const updated: SessionData = {
		...data,
		warnings: 0,
		lastActiveAt: Date.now(),
	};
	await setSessionData({ sessionId, data: updated });
};

export const buildSessionCookie = (sessionId: string): string => {
	const secure = process.env.NODE_ENV !== "development" ? "; Secure" : "";
	return `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Strict; Max-Age=${COOKIE_MAX_AGE}; Path=/${secure}`;
};
