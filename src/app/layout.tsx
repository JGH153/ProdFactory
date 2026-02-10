"use client";

import LogRocket from "logrocket";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

LogRocket.init("vibing-projects/prodfactory");

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className="min-h-screen bg-background text-text-primary antialiased">
				<AppProviders>{children}</AppProviders>
			</body>
		</html>
	);
}
