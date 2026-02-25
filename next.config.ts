import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			`script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.logrocket.io https://cdn.lr-ingest.io https://cdn.lr-in.com https://cdn.lr-in-prod.com https://cdn.logr-in.com`,
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob:",
			"font-src 'self' data:",
			"connect-src 'self' https://*.logrocket.io https://*.lr-ingest.io https://*.lr-in.com https://*.lr-in-prod.com https://*.logr-in.com",
			"worker-src 'self' blob:",
			"media-src 'self'",
			"frame-ancestors 'none'",
		].join("; "),
	},
];

const nextConfig: NextConfig = {
	reactCompiler: true,
	headers: async () => [
		{
			source: "/(.*)",
			headers: securityHeaders,
		},
	],
};

export default nextConfig;
