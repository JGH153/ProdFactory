import type { SerializedGameState } from "@/game/serialization";
import type { ResourceId } from "@/game/types";

// --- Error classes ---

export class ConflictError extends Error {
	state: SerializedGameState;
	serverVersion: number;

	constructor(state: SerializedGameState, serverVersion: number) {
		super("Version conflict");
		this.name = "ConflictError";
		this.state = state;
		this.serverVersion = serverVersion;
	}
}

class ActionFailedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ActionFailedError";
	}
}

// --- Response types ---

type LoadGameResponse = {
	state: SerializedGameState;
	serverVersion: number;
};

type SaveGameResponse = {
	serverVersion: number;
};

type SyncGameResponse = {
	state: SerializedGameState | null;
	serverVersion: number;
	warning: string | null;
};

type ActionResponse = {
	state: SerializedGameState;
	serverVersion: number;
};

// --- Session retry ---

const ensureSession = async (): Promise<void> => {
	await fetch("/api/session", { method: "POST" });
};

const fetchWithSessionRetry = async (
	url: string,
	init?: RequestInit,
): Promise<Response> => {
	const response = await fetch(url, init);
	if (response.status === 401) {
		await ensureSession();
		return fetch(url, init);
	}
	return response;
};

const postJson = (url: string, body: object): Promise<Response> =>
	fetchWithSessionRetry(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

// --- Conflict handler ---

const handleConflict = async (response: Response): Promise<never> => {
	const data = await response.json();
	throw new ConflictError(data.state, data.serverVersion);
};

// --- API functions ---

export const loadGame = async (): Promise<LoadGameResponse | null> => {
	const response = await fetchWithSessionRetry("/api/game");
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new Error(`Load game failed: ${response.status}`);
	}
	return response.json();
};

export const saveGame = async (
	state: SerializedGameState,
	serverVersion: number,
): Promise<SaveGameResponse> => {
	const response = await postJson("/api/game/save", { state, serverVersion });
	if (response.status === 409) {
		return handleConflict(response);
	}
	if (!response.ok) {
		throw new Error(`Save game failed: ${response.status}`);
	}
	return response.json();
};

export const syncGame = async (
	state: SerializedGameState,
	serverVersion: number,
): Promise<SyncGameResponse> => {
	const response = await postJson("/api/game/sync", { state, serverVersion });
	if (response.status === 409) {
		return handleConflict(response);
	}
	if (!response.ok) {
		throw new Error(`Sync game failed: ${response.status}`);
	}
	return response.json();
};

export const postAction = async (
	endpoint: string,
	resourceId: ResourceId,
	serverVersion: number,
): Promise<ActionResponse> => {
	const response = await postJson(`/api/game/${endpoint}`, {
		resourceId,
		serverVersion,
	});
	if (response.status === 409) {
		return handleConflict(response);
	}
	if (response.status === 400) {
		const data = await response.json();
		throw new ActionFailedError(data.error ?? "Action failed");
	}
	if (!response.ok) {
		throw new Error(`Action ${endpoint} failed: ${response.status}`);
	}
	return response.json();
};

export const resetGame = async (
	serverVersion: number,
): Promise<ActionResponse> => {
	const response = await postJson("/api/game/reset", { serverVersion });
	if (response.status === 409) {
		return handleConflict(response);
	}
	if (!response.ok) {
		throw new Error(`Reset game failed: ${response.status}`);
	}
	return response.json();
};
