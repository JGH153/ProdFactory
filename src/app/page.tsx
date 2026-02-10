"use client";

import { GameBoard } from "@/components/game-board";
import { IntroVideoDialog } from "@/components/intro-video-dialog";
import { Logo } from "@/components/logo";
import { MusicButton } from "@/components/music-button";

export default function Home() {
	return (
		<main className="min-h-screen flex flex-col items-center px-4 py-8">
			<div className="flex items-center gap-2">
				<Logo />
				<IntroVideoDialog />
				<MusicButton />
			</div>
			<GameBoard />
		</main>
	);
}
