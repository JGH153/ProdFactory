"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { GameBoard } from "@/components/game-board";
import {
	hasSeenIntro,
	IntroVideoDialog,
} from "@/components/intro-video-dialog";
import { Logo } from "@/components/logo";
import { OfflineSummaryModal } from "@/components/offline-summary-modal";
import { ResearchPage } from "@/components/research-page";
import { SettingsPage } from "@/components/settings-page";
import { ShopPage } from "@/components/shop-page";
import { useGameState } from "@/game/game-state-context";
import { useMilestoneNotification } from "@/game/milestone-context";
import { MusicProvider } from "@/game/music-context";

type ActiveTab = "game" | "shop" | "research" | "settings";

export default function Home() {
	const [activeTab, setActiveTab] = useState<ActiveTab>("game");
	const [introOpen, setIntroOpen] = useState(false);
	const { offlineSummary, collectOfflineProgress } = useGameState();
	const { registerNavigate } = useMilestoneNotification();

	useEffect(() => {
		registerNavigate(setActiveTab);
	}, [registerNavigate]);

	useEffect(() => {
		if (!hasSeenIntro()) {
			setIntroOpen(true);
		}
	}, []);

	return (
		<MusicProvider>
			<main className="min-h-screen flex flex-col items-center px-4 pt-8 pb-24">
				<Logo />
				{activeTab === "game" && <GameBoard />}
				{activeTab === "shop" && <ShopPage />}
				{activeTab === "research" && <ResearchPage />}
				{activeTab === "settings" && (
					<SettingsPage
						onReset={() => setActiveTab("game")}
						onWatchIntro={() => setIntroOpen(true)}
					/>
				)}
				<IntroVideoDialog open={introOpen} onOpenChange={setIntroOpen} />
				<OfflineSummaryModal
					summary={offlineSummary}
					onCollect={collectOfflineProgress}
				/>
			</main>
			<BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
		</MusicProvider>
	);
}
