"use client";

import { GameBoard } from "@/components/game-board";
import { IntroVideoDialog } from "@/components/intro-video-dialog";
import { Logo } from "@/components/logo";
import { MusicButton } from "@/components/music-button";
import { NewGameButton } from "@/components/new-game-button";
import { SfxButton } from "@/components/sfx-button";
import { SfxProvider } from "@/game/sfx-context";

export default function Home() {
	return (
		<SfxProvider>
			<main className="min-h-screen flex flex-col items-center px-4 py-8">
				<div className="flex items-center gap-2">
					<Logo />
					<IntroVideoDialog />
					<MusicButton />
					<SfxButton />
					<NewGameButton />
				</div>
				<GameBoard />
			</main>
		</SfxProvider>
	);
}
