"use client";

import LogRocket from "logrocket";
import { IS_PRODUCTION } from "@/lib/env-frontend";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

if (IS_PRODUCTION) {
	LogRocket.init("vibing-projects/prodfactory");
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<head>
				<title>ProdFactory</title>
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/favicon-16x16.png"
				/>
			</head>
			<body className="min-h-screen overflow-x-hidden bg-background text-text-primary antialiased">
				<a
					href="#main-content"
					className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:font-semibold"
				>
					Skip to main content
				</a>
				<AppProviders>{children}</AppProviders>
			</body>
		</html>
	);
}
