const { mockGet, mockSet, mockDel, mockIncr, mockExpire } = vi.hoisted(() => {
	process.env.REDIS_URL = "redis://localhost:6379";
	return {
		mockGet: vi.fn(),
		mockSet: vi.fn(),
		mockDel: vi.fn(),
		mockIncr: vi.fn(),
		mockExpire: vi.fn(),
	};
});

vi.mock("ioredis", () => ({
	default: class {
		get = mockGet;
		set = mockSet;
		del = mockDel;
		incr = mockIncr;
		expire = mockExpire;
	},
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SerializedResourceState } from "@/game/serialization";
import type { ResourceId } from "@/game/types";
import {
	deleteSyncSnapshot,
	getSessionData,
	getSyncSnapshot,
	incrementRateLimitCounter,
	loadStoredGameState,
	type SessionData,
	type StoredGameState,
	type SyncSnapshot,
	saveStoredGameState,
	setSessionData,
	setSyncSnapshot,
} from "./redis";

// --- Fixtures ---

const ALL_RESOURCE_IDS: ResourceId[] = [
	"iron-ore",
	"plates",
	"reinforced-plate",
	"modular-frame",
	"heavy-modular-frame",
	"fused-modular-frame",
	"pressure-conversion-cube",
	"nuclear-pasta",
];

const makeMinimalResource = (id: ResourceId): SerializedResourceState => ({
	id,
	amount: { m: 0, e: 0 },
	producers: 0,
	isUnlocked: true,
	isAutomated: false,
	runStartedAt: null,
});

const makeResources = (): Record<ResourceId, SerializedResourceState> =>
	Object.fromEntries(
		ALL_RESOURCE_IDS.map((id) => [id, makeMinimalResource(id)]),
	) as Record<ResourceId, SerializedResourceState>;

const mockStoredGameState: StoredGameState = {
	resources: makeResources(),
	shopBoosts: {
		"production-20x": false,
		"automation-2x": false,
		"runtime-50": false,
	},
	lastSavedAt: 1700000000000,
	version: 4,
	serverVersion: 1,
};

const mockSessionData: SessionData = {
	createdAt: 1700000000000,
	lastActiveAt: 1700000001000,
	warnings: 0,
};

const mockSyncSnapshot: SyncSnapshot = {
	timestamp: 1700000000000,
	resources: Object.fromEntries(
		ALL_RESOURCE_IDS.map((id) => [
			id,
			{ amount: { m: 0, e: 0 }, producers: 0 },
		]),
	) as SyncSnapshot["resources"],
};

// --- Tests ---

beforeEach(() => {
	vi.clearAllMocks();
});

describe("loadStoredGameState", () => {
	it("returns null when redis has no entry", async () => {
		mockGet.mockResolvedValue(null);
		const result = await loadStoredGameState("sess-abc");
		expect(result).toBeNull();
		expect(mockGet).toHaveBeenCalledWith("game:sess-abc");
	});

	it("parses and returns stored state when redis has a value", async () => {
		mockGet.mockResolvedValue(JSON.stringify(mockStoredGameState));
		const result = await loadStoredGameState("sess-abc");
		expect(result).toEqual(mockStoredGameState);
	});
});

describe("saveStoredGameState", () => {
	it("calls redis.set with correct key, serialized value, and TTL", async () => {
		mockSet.mockResolvedValue("OK");
		await saveStoredGameState({
			sessionId: "sess-abc",
			stored: mockStoredGameState,
		});
		expect(mockSet).toHaveBeenCalledWith(
			"game:sess-abc",
			JSON.stringify(mockStoredGameState),
			"EX",
			2592000,
		);
	});
});

describe("getSessionData", () => {
	it("returns null when redis has no entry", async () => {
		mockGet.mockResolvedValue(null);
		const result = await getSessionData("sess-abc");
		expect(result).toBeNull();
		expect(mockGet).toHaveBeenCalledWith("session:sess-abc");
	});

	it("parses and returns session data when redis has a value", async () => {
		mockGet.mockResolvedValue(JSON.stringify(mockSessionData));
		const result = await getSessionData("sess-abc");
		expect(result).toEqual(mockSessionData);
	});
});

describe("setSessionData", () => {
	it("calls redis.set with correct key, serialized data, and TTL", async () => {
		mockSet.mockResolvedValue("OK");
		await setSessionData({ sessionId: "sess-abc", data: mockSessionData });
		expect(mockSet).toHaveBeenCalledWith(
			"session:sess-abc",
			JSON.stringify(mockSessionData),
			"EX",
			2592000,
		);
	});
});

describe("getSyncSnapshot", () => {
	it("returns null when redis has no entry", async () => {
		mockGet.mockResolvedValue(null);
		const result = await getSyncSnapshot("sess-abc");
		expect(result).toBeNull();
		expect(mockGet).toHaveBeenCalledWith("sync:sess-abc");
	});

	it("parses and returns snapshot when redis has a value", async () => {
		mockGet.mockResolvedValue(JSON.stringify(mockSyncSnapshot));
		const result = await getSyncSnapshot("sess-abc");
		expect(result).toEqual(mockSyncSnapshot);
	});
});

describe("setSyncSnapshot", () => {
	it("calls redis.set with correct key, serialized snapshot, and TTL", async () => {
		mockSet.mockResolvedValue("OK");
		await setSyncSnapshot({
			sessionId: "sess-abc",
			snapshot: mockSyncSnapshot,
		});
		expect(mockSet).toHaveBeenCalledWith(
			"sync:sess-abc",
			JSON.stringify(mockSyncSnapshot),
			"EX",
			2592000,
		);
	});
});

describe("deleteSyncSnapshot", () => {
	it("calls redis.del with the correct key", async () => {
		mockDel.mockResolvedValue(1);
		await deleteSyncSnapshot("sess-abc");
		expect(mockDel).toHaveBeenCalledWith("sync:sess-abc");
	});
});

describe("incrementRateLimitCounter", () => {
	it("calls expire when incr returns 1 and returns the count", async () => {
		mockIncr.mockResolvedValue(1);
		mockExpire.mockResolvedValue(1);
		const result = await incrementRateLimitCounter({
			key: "rl:abc",
			windowSeconds: 60,
		});
		expect(result).toBe(1);
		expect(mockIncr).toHaveBeenCalledWith("rl:abc");
		expect(mockExpire).toHaveBeenCalledWith("rl:abc", 60);
	});

	it("does not call expire when incr returns 2 and returns the count", async () => {
		mockIncr.mockResolvedValue(2);
		const result = await incrementRateLimitCounter({
			key: "rl:abc",
			windowSeconds: 60,
		});
		expect(result).toBe(2);
		expect(mockExpire).not.toHaveBeenCalled();
	});

	it("forwards windowSeconds exactly", async () => {
		mockIncr.mockResolvedValue(1);
		mockExpire.mockResolvedValue(1);
		await incrementRateLimitCounter({ key: "rl:abc", windowSeconds: 300 });
		expect(mockExpire).toHaveBeenCalledWith("rl:abc", 300);
	});

	it("passes the key through verbatim without modification", async () => {
		mockIncr.mockResolvedValue(5);
		await incrementRateLimitCounter({
			key: "rate-limit:user:xyz:action:buy",
			windowSeconds: 60,
		});
		expect(mockIncr).toHaveBeenCalledWith("rate-limit:user:xyz:action:buy");
	});
});
