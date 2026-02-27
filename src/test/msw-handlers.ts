import { HttpResponse, http } from "msw";
import { createInitialSerializedState } from "./fixtures";

export const handlers = [
	// Load game
	http.get("/api/game", () => {
		return HttpResponse.json({
			state: createInitialSerializedState(),
			serverVersion: 1,
		});
	}),

	// Save game
	http.post("/api/game/save", async ({ request }) => {
		const body = (await request.json()) as { serverVersion: number };
		return HttpResponse.json({
			serverVersion: body.serverVersion + 1,
			state: null,
			warning: null,
		});
	}),

	// Sync game
	http.post("/api/game/sync", async ({ request }) => {
		const body = (await request.json()) as { serverVersion: number };
		return HttpResponse.json({
			state: null,
			serverVersion: body.serverVersion + 1,
			warning: null,
		});
	}),

	// Generic action handler (buy-producer, unlock, etc.)
	http.post("/api/game/:action", async ({ request }) => {
		const body = (await request.json()) as { serverVersion: number };
		return HttpResponse.json({
			state: createInitialSerializedState(),
			serverVersion: body.serverVersion + 1,
		});
	}),

	// Session creation
	http.post("/api/session", () => {
		return new HttpResponse(null, { status: 204 });
	}),
];
