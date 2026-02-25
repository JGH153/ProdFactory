import { incrementRateLimitCounter } from "./redis";

type RateLimitResult = {
	allowed: boolean;
	remaining: number;
};

export const checkRateLimit = async ({
	key,
	maxRequests,
	windowSeconds,
}: {
	key: string;
	maxRequests: number;
	windowSeconds: number;
}): Promise<RateLimitResult> => {
	const current = await incrementRateLimitCounter({
		key: `ratelimit:${key}`,
		windowSeconds,
	});

	return {
		allowed: current <= maxRequests,
		remaining: Math.max(0, maxRequests - current),
	};
};
