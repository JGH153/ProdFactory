"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { GameBoard } from "@/components/game-board";
import {
	hasSeenIntro,
	IntroVideoDialog,
} from "@/components/intro-video-dialog";
import { Logo } from "@/components/logo";
import { MusicButton } from "@/components/music-button";
import { SettingsPage } from "@/components/settings-page";
import { SfxButton } from "@/components/sfx-button";
import { ShopPage } from "@/components/shop-page";
import { SfxProvider } from "@/game/sfx-context";

type ActiveTab = "game" | "shop" | "settings";

export default function Home() {
	const [activeTab, setActiveTab] = useState<ActiveTab>("game");
	const [introOpen, setIntroOpen] = useState(false);

	useEffect(() => {
		if (!hasSeenIntro()) {
			setIntroOpen(true);
		}
	}, []);

	return (
		<SfxProvider>
			<main className="min-h-screen flex flex-col items-center px-4 pt-8 pb-24">
				<div className="flex items-center gap-2">
					<Logo />
					<MusicButton />
					<SfxButton />
				</div>
				{activeTab === "game" && <GameBoard />}
				{activeTab === "shop" && <ShopPage />}
				{activeTab === "settings" && (
					<SettingsPage
						onReset={() => setActiveTab("game")}
						onWatchIntro={() => setIntroOpen(true)}
					/>
				)}
				<IntroVideoDialog open={introOpen} onOpenChange={setIntroOpen} />
			</main>
			<BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
		</SfxProvider>
	);
}
