import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ConflictError,
	loadGame,
	postAction,
	resetGame,
	saveGame,
	syncGame,
} from "./api-client";

// --- Mock global fetch ---

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
	vi.clearAllMocks();
});

// --- Helpers ---

const jsonResponse = ({
	status,
	body,
}: {
	status: number;
	body: unknown;
}): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	}) as unknown as Response;

const mockState = { resources: {}, lastSavedAt: 0, version: 1 };

const getSentBody = (): Record<string, unknown> => {
	const init = mockFetch.mock.calls[0]?.[1] as { body: string } | undefined;
	if (!init) {
		throw new Error("fetch was not called with init");
	}
	return JSON.parse(init.body);
};

// --- Tests ---

describe("ConflictError", () => {
	it("stores state and serverVersion", () => {
		const error = new ConflictError({
			state: mockState as never,
			serverVersion: 5,
		});
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("ConflictError");
		expect(error.message).toBe("Version conflict");
		expect(error.state).toBe(mockState);
		expect(error.serverVersion).toBe(5);
	});
});

describe("loadGame", () => {
	it("returns parsed JSON on success", async () => {
		const body = { state: mockState, serverVersion: 3 };
		mockFetch.mockResolvedValue(jsonResponse({ status: 200, body }));

		const result = await loadGame();

		expect(result).toEqual(body);
		expect(mockFetch).toHaveBeenCalledWith("/api/game", undefined);
	});

	it("returns null on 404", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 404, body: null }));

		const result = await loadGame();

		expect(result).toBeNull();
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 500, body: null }));

		await expect(loadGame()).rejects.toThrow("Load game failed: 500");
	});

	it("retries after creating session on 401", async () => {
		const body = { state: mockState, serverVersion: 1 };
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ status: 401, body: null }))
			.mockResolvedValueOnce(jsonResponse({ status: 200, body: null })) // session POST
			.mockResolvedValueOnce(jsonResponse({ status: 200, body })); // retry

		const result = await loadGame();

		expect(result).toEqual(body);
		expect(mockFetch).toHaveBeenCalledTimes(3);
		expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/session", {
			method: "POST",
		});
	});
});

describe("saveGame", () => {
	it("returns parsed JSON on success", async () => {
		const body = { serverVersion: 4 };
		mockFetch.mockResolvedValue(jsonResponse({ status: 200, body }));

		const result = await saveGame({
			state: mockState as never,
			serverVersion: 3,
		});

		expect(result).toEqual(body);
		expect(mockFetch).toHaveBeenCalledWith("/api/game/save", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ state: mockState, serverVersion: 3 }),
		});
	});

	it("throws ConflictError on 409", async () => {
		const conflictBody = { state: mockState, serverVersion: 10 };
		mockFetch.mockResolvedValue(
			jsonResponse({ status: 409, body: conflictBody }),
		);

		try {
			await saveGame({ state: mockState as never, serverVersion: 3 });
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictError);
			expect((error as ConflictError).serverVersion).toBe(10);
		}
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 500, body: null }));

		await expect(
			saveGame({ state: mockState as never, serverVersion: 1 }),
		).rejects.toThrow("Save game failed: 500");
	});
});

describe("syncGame", () => {
	it("returns parsed JSON on success", async () => {
		const body = { state: null, serverVersion: 5, warning: null };
		mockFetch.mockResolvedValue(jsonResponse({ status: 200, body }));

		const result = await syncGame({
			state: mockState as never,
			serverVersion: 4,
		});

		expect(result).toEqual(body);
		expect(mockFetch).toHaveBeenCalledWith("/api/game/sync", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ state: mockState, serverVersion: 4 }),
		});
	});

	it("throws ConflictError on 409", async () => {
		const conflictBody = { state: mockState, serverVersion: 8 };
		mockFetch.mockResolvedValue(
			jsonResponse({ status: 409, body: conflictBody }),
		);

		try {
			await syncGame({ state: mockState as never, serverVersion: 4 });
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictError);
			expect((error as ConflictError).serverVersion).toBe(8);
		}
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 500, body: null }));

		await expect(
			syncGame({ state: mockState as never, serverVersion: 1 }),
		).rejects.toThrow("Sync game failed: 500");
	});
});

describe("postAction", () => {
	it("returns parsed JSON on success", async () => {
		const body = { state: mockState, serverVersion: 2 };
		mockFetch.mockResolvedValue(jsonResponse({ status: 200, body }));

		const result = await postAction({
			endpoint: "buy-producer",
			resourceId: "iron-ore",
			serverVersion: 1,
		});

		expect(result).toEqual(body);
	});

	it("includes resourceId in body when provided", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({
				status: 200,
				body: { state: mockState, serverVersion: 2 },
			}),
		);

		await postAction({
			endpoint: "buy-producer",
			resourceId: "iron-ore",
			serverVersion: 1,
		});

		const sentBody = getSentBody();
		expect(sentBody.resourceId).toBe("iron-ore");
	});

	it("includes boostId in body when provided", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({
				status: 200,
				body: { state: mockState, serverVersion: 2 },
			}),
		);

		await postAction({
			endpoint: "buy-boost",
			boostId: "production-2x",
			serverVersion: 1,
		});

		const sentBody = getSentBody();
		expect(sentBody.boostId).toBe("production-2x");
		expect(sentBody).not.toHaveProperty("resourceId");
	});

	it("omits resourceId and boostId when not provided", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({
				status: 200,
				body: { state: mockState, serverVersion: 2 },
			}),
		);

		await postAction({ endpoint: "toggle-pause", serverVersion: 1 });

		const sentBody = getSentBody();
		expect(sentBody).toEqual({ serverVersion: 1 });
	});

	it("throws ConflictError on 409", async () => {
		const conflictBody = { state: mockState, serverVersion: 7 };
		mockFetch.mockResolvedValue(
			jsonResponse({ status: 409, body: conflictBody }),
		);

		try {
			await postAction({
				endpoint: "buy-producer",
				resourceId: "iron-ore",
				serverVersion: 1,
			});
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictError);
			expect((error as ConflictError).serverVersion).toBe(7);
		}
	});

	it("throws ActionFailedError on 400 with server message", async () => {
		mockFetch.mockResolvedValue(
			jsonResponse({ status: 400, body: { error: "Not enough resources" } }),
		);

		await expect(
			postAction({
				endpoint: "buy-producer",
				resourceId: "iron-ore",
				serverVersion: 1,
			}),
		).rejects.toThrow("Not enough resources");
	});

	it("throws ActionFailedError with fallback message on 400", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 400, body: {} }));

		await expect(
			postAction({
				endpoint: "buy-producer",
				resourceId: "iron-ore",
				serverVersion: 1,
			}),
		).rejects.toThrow("Action failed");
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 500, body: null }));

		await expect(
			postAction({
				endpoint: "buy-producer",
				resourceId: "iron-ore",
				serverVersion: 1,
			}),
		).rejects.toThrow("Action buy-producer failed: 500");
	});
});

describe("resetGame", () => {
	it("returns parsed JSON on success", async () => {
		const body = { state: mockState, serverVersion: 1 };
		mockFetch.mockResolvedValue(jsonResponse({ status: 200, body }));

		const result = await resetGame(5);

		expect(result).toEqual(body);
		expect(mockFetch).toHaveBeenCalledWith("/api/game/reset", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ serverVersion: 5 }),
		});
	});

	it("throws ConflictError on 409", async () => {
		const conflictBody = { state: mockState, serverVersion: 6 };
		mockFetch.mockResolvedValue(
			jsonResponse({ status: 409, body: conflictBody }),
		);

		try {
			await resetGame(5);
			expect.unreachable("should have thrown");
		} catch (error) {
			expect(error).toBeInstanceOf(ConflictError);
			expect((error as ConflictError).serverVersion).toBe(6);
		}
	});

	it("throws on non-ok response", async () => {
		mockFetch.mockResolvedValue(jsonResponse({ status: 500, body: null }));

		await expect(resetGame(1)).rejects.toThrow("Reset game failed: 500");
	});
});
