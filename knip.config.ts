import type { KnipConfig } from "knip";

const config: KnipConfig = {
	entry: [
		"src/app/**/*.{ts,tsx}",
		"src/app/**/route.ts",
		"next.config.ts",
		"vitest.config.ts",
	],
	project: ["src/**/*.{ts,tsx}"],
	ignore: ["src/**/*.test.ts"],
};

export default config;
