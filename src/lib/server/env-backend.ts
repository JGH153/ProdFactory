export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const isTest = Boolean(process.env.VITEST);

export const LOG_LEVEL = isTest
	? (process.env.TEST_LOG_LEVEL ?? "silent")
	: (process.env.LOG_LEVEL ?? "info");

export const LOG_HIDE_OBJECT = process.env.LOG_HIDE_OBJECT === "true";

export const getRedisUrl = (): string => {
	const url = process.env.REDIS_URL;
	if (!url) {
		throw new Error("REDIS_URL environment variable is not set");
	}
	return url;
};
