import Redis from "ioredis";
import type { SerializedGameState } from "@/game/serialization";
import type { ResourceId } from "@/game/types";
import type { SerializedBigNum } from "@/lib/big-number";

const TTL_30_DAYS = 60 * 60 * 24 * 30;

const getRedisUrl = (): string => {
	const url = process.env.REDIS_URL;
	if (!url) {
		throw new Error("REDIS_URL environment variable is not set");
	}
	return url;
};

const redis = new Redis(getRedisUrl(), {
	maxRetriesPerRequest: 3,
	lazyConnect: true,
});

// --- Types ---

export type StoredGameState = SerializedGameState & {
	serverVersion: number;
};

export type SessionData = {
	createdAt: number;
	lastActiveAt: number;
	warnings: number;
};

type SyncSnapshotResource = {
	amount: SerializedBigNum;
	producers: number;
};

export type SyncSnapshot = {
	timestamp: number;
	resources: Record<ResourceId, SyncSnapshotResource>;
};

// --- Game state ---

export const loadStoredGameState = async (
	sessionId: string,
): Promise<StoredGameState | null> => {
	const raw = await redis.get(`game:${sessionId}`);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as StoredGameState;
};

export const saveStoredGameState = async ({
	sessionId,
	stored,
}: {
	sessionId: string;
	stored: StoredGameState;
}): Promise<void> => {
	await redis.set(
		`game:${sessionId}`,
		JSON.stringify(stored),
		"EX",
		TTL_30_DAYS,
	);
};

// --- Sessions ---

export const getSessionData = async (
	sessionId: string,
): Promise<SessionData | null> => {
	const raw = await redis.get(`session:${sessionId}`);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as SessionData;
};

export const setSessionData = async ({
	sessionId,
	data,
}: {
	sessionId: string;
	data: SessionData;
}): Promise<void> => {
	await redis.set(
		`session:${sessionId}`,
		JSON.stringify(data),
		"EX",
		TTL_30_DAYS,
	);
};

// --- Sync snapshots ---

export const getSyncSnapshot = async (
	sessionId: string,
): Promise<SyncSnapshot | null> => {
	const raw = await redis.get(`sync:${sessionId}`);
	if (!raw) {
		return null;
	}
	return JSON.parse(raw) as SyncSnapshot;
};

export const setSyncSnapshot = async ({
	sessionId,
	snapshot,
}: {
	sessionId: string;
	snapshot: SyncSnapshot;
}): Promise<void> => {
	await redis.set(
		`sync:${sessionId}`,
		JSON.stringify(snapshot),
		"EX",
		TTL_30_DAYS,
	);
};

export const deleteSyncSnapshot = async (sessionId: string): Promise<void> => {
	await redis.del(`sync:${sessionId}`);
};

// --- Rate limiting ---

export const incrementRateLimitCounter = async ({
	key,
	windowSeconds,
}: {
	key: string;
	windowSeconds: number;
}): Promise<number> => {
	const current = await redis.incr(key);
	if (current === 1) {
		await redis.expire(key, windowSeconds);
	}
	return current;
};
