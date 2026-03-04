import pino from "pino";
import { IS_DEVELOPMENT, LOG_HIDE_OBJECT, LOG_LEVEL } from "./env-backend";

export const logger = pino({
	level: LOG_LEVEL,
	...(IS_DEVELOPMENT && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				levelFirst: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
				hideObject: LOG_HIDE_OBJECT,
			},
		},
	}),
});
