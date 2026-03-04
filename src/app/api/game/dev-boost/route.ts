import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RESOURCE_ORDER } from "@/game/config";
import type {
	SerializedGameState,
	SerializedResourceState,
} from "@/game/state/serialization";
import type { ResourceId } from "@/game/types";
import { bigNum, bnDeserialize, bnGte, bnSerialize } from "@/lib/big-number";
import {
	getSessionFromRequest,
	parseVersionOnlyBody,
	stripServerVersion,
} from "@/lib/server/api-helpers";
import { logger } from "@/lib/server/logger";
import { buildSyncSnapshot } from "@/lib/server/plausibility";
import {
	loadStoredGameState,
	saveStoredGameState,
	setSyncSnapshot,
} from "@/lib/server/redis";

const BOOST_AMOUNT = bigNum(100);
const BOOST_PRODUCERS = 10;

const applyDevBoost = (state: SerializedGameState): SerializedGameState => {
	const boostedResources = {} as Record<ResourceId, SerializedResourceState>;
	const serializedBoostAmount = bnSerialize(BOOST_AMOUNT);

	for (const resourceId of RESOURCE_ORDER) {
		const resource = state.resources[resourceId];
		const currentAmount = bnDeserialize(resource.amount);
		const keepExisting = bnGte(currentAmount, BOOST_AMOUNT);

		boostedResources[resourceId] = {
			...resource,
			isUnlocked: true,
			amount: keepExisting ? resource.amount : serializedBoostAmount,
			producers: Math.max(resource.producers, BOOST_PRODUCERS),
			isAutomated: true,
		};
	}

	return { ...state, resources: boostedResources };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
	if (process.env.NODE_ENV !== "development") {
		return NextResponse.json({ error: "Dev-only endpoint" }, { status: 403 });
	}

	const sessionResult = await getSessionFromRequest(request);
	if (sessionResult instanceof NextResponse) {
		return sessionResult;
	}
	const { sessionId } = sessionResult;

	const body = await parseVersionOnlyBody(request);
	if (body instanceof NextResponse) {
		return body;
	}

	const stored = await loadStoredGameState(sessionId);
	if (!stored) {
		return NextResponse.json({ error: "No game state found" }, { status: 404 });
	}

	if (stored.serverVersion !== body.serverVersion) {
		return NextResponse.json(
			{
				state: stripServerVersion(stored),
				serverVersion: stored.serverVersion,
			},
			{ status: 409 },
		);
	}

	const boostedState = applyDevBoost(stripServerVersion(stored));
	const newVersion = stored.serverVersion + 1;

	const snapshot = buildSyncSnapshot({
		state: boostedState,
		timestamp: Date.now(),
	});

	await Promise.all([
		saveStoredGameState({
			sessionId,
			stored: { ...boostedState, serverVersion: newVersion },
		}),
		setSyncSnapshot({ sessionId, snapshot }),
	]);

	logger.info({ sessionId }, "Dev boost applied");

	return NextResponse.json({
		state: boostedState,
		serverVersion: newVersion,
	});
};
