"use client";

import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

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
