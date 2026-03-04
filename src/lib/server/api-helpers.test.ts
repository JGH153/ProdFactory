import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createInitialGameState } from "@/game/initial-state";
import { serializeGameState } from "@/game/state/serialization";
import {
	parseSaveActionBody,
	parseVersionOnlyBody,
	stripServerVersion,
} from "./api-helpers";

// Mock next/server with a proper class so instanceof checks work in source
vi.mock("next/server", () => {
	class NextResponse {
		readonly status: number;
		private readonly _body: unknown;

		constructor(body?: unknown, init?: { status?: number }) {
			this.status = init?.status ?? 200;
			this._body = body;
		}

		static json(body: unknown, init?: { status?: number }): NextResponse {
			return new NextResponse(body, init);
		}

		async json(): Promise<unknown> {
			return this._body;
		}
	}

	return { NextResponse };
});

// Block Redis initialization (redis.ts runs new Redis() at module level)
vi.mock("./redis", () => ({
	loadStoredGameState: vi.fn(),
	saveStoredGameState: vi.fn(),
	getSyncSnapshot: vi.fn(),
	setSyncSnapshot: vi.fn(),
}));

vi.mock("./session", () => ({
	COOKIE_NAME: "pf-session",
	validateSession: vi.fn(),
	incrementWarnings: vi.fn(),
}));

vi.mock("./plausibility", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./plausibility")>();
	return {
		...actual,
		buildSyncSnapshot: vi.fn(),
		checkPlausibility: vi.fn(),
	};
});

// --- Helpers ---

const makeRequest = (body: unknown): NextRequest =>
	({ json: async () => body }) as unknown as NextRequest;

const makeBadRequest = (): NextRequest =>
	({
		json: async (): Promise<never> => {
			throw new SyntaxError("bad json");
		},
	}) as unknown as NextRequest;

type Res = { status: number; json: () => Promise<{ error?: string }> };
const asRes = (r: unknown): Res => r as Res;

const validState = serializeGameState(createInitialGameState());

// --- Tests ---

describe("stripServerVersion", () => {
	it("removes serverVersion from stored state", () => {
		const stored = { ...validState, serverVersion: 42 };
		const result = stripServerVersion(stored);
		expect(result).not.toHaveProperty("serverVersion");
	});

	it("preserves resources, lastSavedAt, and version", () => {
		const stored = { ...validState, serverVersion: 7 };
		const result = stripServerVersion(stored);
		expect(result.resources).toEqual(validState.resources);
		expect(result.lastSavedAt).toBe(validState.lastSavedAt);
		expect(result.version).toBe(validState.version);
	});
});

describe("parseVersionOnlyBody", () => {
	it("valid body returns parsed serverVersion", async () => {
		const result = await parseVersionOnlyBody(
			makeRequest({ serverVersion: 5 }),
		);
		expect(result).toEqual({ serverVersion: 5 });
	});

	it("returns 400 on JSON parse error", async () => {
		const res = asRes(await parseVersionOnlyBody(makeBadRequest()));
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "Invalid JSON body" });
	});

	it("returns 400 when body is an array", async () => {
		const res = asRes(await parseVersionOnlyBody(makeRequest([1, 2])));
		expect(res.status).toBe(400);
	});

	it("returns 400 when serverVersion is missing", async () => {
		const res = asRes(await parseVersionOnlyBody(makeRequest({})));
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "Invalid serverVersion" });
	});

	it("returns 400 when serverVersion is negative", async () => {
		const res = asRes(
			await parseVersionOnlyBody(makeRequest({ serverVersion: -1 })),
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when serverVersion is a float", async () => {
		const res = asRes(
			await parseVersionOnlyBody(makeRequest({ serverVersion: 1.5 })),
		);
		expect(res.status).toBe(400);
	});
});

describe("parseSaveActionBody", () => {
	it("valid body returns parsed state and serverVersion", async () => {
		const result = await parseSaveActionBody(
			makeRequest({ state: validState, serverVersion: 3 }),
		);
		expect(result).toMatchObject({ serverVersion: 3 });
		expect((result as { state: unknown }).state).toBeDefined();
	});

	it("returns 400 on JSON parse error", async () => {
		const res = asRes(await parseSaveActionBody(makeBadRequest()));
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "Invalid JSON body" });
	});

	it("returns 400 when body is not an object", async () => {
		const res = asRes(await parseSaveActionBody(makeRequest("not-object")));
		expect(res.status).toBe(400);
	});

	it("returns 400 when serverVersion is invalid", async () => {
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: validState, serverVersion: "bad" }),
			),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "Invalid serverVersion" });
	});

	it("returns 400 when state is not an object", async () => {
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: "bad", serverVersion: 0 }),
			),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ error: "Invalid state" });
	});

	it("returns 400 for state missing lastSavedAt", async () => {
		const { lastSavedAt: _removed, ...stateWithout } = validState;
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: stateWithout, serverVersion: 0 }),
			),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({
			error: "Missing or invalid lastSavedAt",
		});
	});

	it("returns 400 for state missing version", async () => {
		const { version: _removed, ...stateWithout } = validState;
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: stateWithout, serverVersion: 0 }),
			),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({
			error: "Missing or invalid version",
		});
	});

	it("returns 400 for resource with invalid BigNum amount", async () => {
		const corruptedState = {
			...validState,
			resources: {
				...validState.resources,
				"iron-ore": {
					...validState.resources["iron-ore"],
					amount: { m: 0.5, e: 3 }, // m < 1 is invalid
				},
			},
		};
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: corruptedState, serverVersion: 0 }),
			),
		);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({
			error: "Invalid amount for iron-ore",
		});
	});

	it("returns 400 for shopBoosts with unrecognized boost id", async () => {
		const stateWithBadBoost = {
			...validState,
			shopBoosts: { "hacker-boost": true },
		};
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: stateWithBadBoost, serverVersion: 0 }),
			),
		);
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toContain(
			"Invalid boost id",
		);
	});

	it("returns 400 for shopBoosts with non-boolean value", async () => {
		const stateWithBadValue = {
			...validState,
			shopBoosts: { "production-20x": 1 },
		};
		const res = asRes(
			await parseSaveActionBody(
				makeRequest({ state: stateWithBadValue, serverVersion: 0 }),
			),
		);
		expect(res.status).toBe(400);
		expect(((await res.json()) as { error: string }).error).toContain(
			"Invalid boost value",
		);
	});
});
