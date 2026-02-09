"use client";

import { GameBoard } from "@/components/game-board";
import { Logo } from "@/components/logo";

export default function Home() {
	return (
		<main className="min-h-screen flex flex-col items-center px-4 py-8">
			<Logo />
			<GameBoard />
		</main>
	);
}
