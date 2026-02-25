import pino from "pino";

const isTest = Boolean(process.env.VITEST);

const level = isTest
	? (process.env.TEST_LOG_LEVEL ?? "silent")
	: (process.env.LOG_LEVEL ?? "info");

export const logger = pino({
	level,
	...(process.env.NODE_ENV === "development" && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				levelFirst: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
				hideObject: process.env.LOG_HIDE_OBJECT === "true",
			},
		},
	}),
});
