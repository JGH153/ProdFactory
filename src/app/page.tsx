"use client";

import { useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { GameBoard } from "@/components/game-board";
import { IntroVideoDialog } from "@/components/intro-video-dialog";
import { Logo } from "@/components/logo";
import { MusicButton } from "@/components/music-button";
import { NewGameButton } from "@/components/new-game-button";
import { SfxButton } from "@/components/sfx-button";
import { ShopPage } from "@/components/shop-page";
import { SfxProvider } from "@/game/sfx-context";

type ActiveTab = "game" | "shop";

export default function Home() {
	const [activeTab, setActiveTab] = useState<ActiveTab>("game");

	return (
		<SfxProvider>
			<main className="min-h-screen flex flex-col items-center px-4 pt-8 pb-24">
				<div className="flex items-center gap-2">
					<Logo />
					<IntroVideoDialog />
					<MusicButton />
					<SfxButton />
					<NewGameButton />
				</div>
				{activeTab === "game" ? <GameBoard /> : <ShopPage />}
			</main>
			<BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
		</SfxProvider>
	);
}
