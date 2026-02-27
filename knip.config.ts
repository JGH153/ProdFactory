import type { KnipConfig } from "knip";

const config: KnipConfig = {
	entry: ["src/app/**/*.{ts,tsx}", "src/app/**/route.ts"],
	project: ["src/**/*.{ts,tsx}"],
	ignore: ["src/components/ui/**"],
	ignoreDependencies: [
		"tailwindcss",
		"postcss",
		"postcss-load-config",
		"pino-pretty",
	],
};

export default config;
