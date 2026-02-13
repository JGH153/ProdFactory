"use client";

import LogRocket from "logrocket";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

if (process.env.NODE_ENV === "production") {
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
			<body className="min-h-screen bg-background text-text-primary antialiased">
				<AppProviders>{children}</AppProviders>
			</body>
		</html>
	);
}
