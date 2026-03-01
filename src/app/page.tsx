"use client";

import { useEffect, useState } from "react";
import {
	hasSeenIntro,
	IntroVideoDialog,
} from "@/components/intro-video-dialog";
import { BottomNav } from "@/components/layout/bottom-nav";
import { GameBoard } from "@/components/layout/game-board";
import { Logo } from "@/components/layout/logo";
import { OfflineSummaryModal } from "@/components/offline-summary-modal";
import { PrestigePage } from "@/components/prestige/prestige-page";
import { ResearchPage } from "@/components/research/research-page";
import { SettingsPage } from "@/components/settings/settings-page";
import { ShopPage } from "@/components/shop-page";
import { useGameState } from "@/game/state/game-state-context";
import { useMilestoneNotification } from "@/game/state/milestone-context";
import { MusicProvider } from "@/game/state/music-context";

type ActiveTab = "game" | "shop" | "research" | "prestige" | "settings";

const TabPanel = ({
	id,
	children,
}: {
	id: ActiveTab;
	children: React.ReactNode;
}) => (
	<div
		role="tabpanel"
		id={`tab-panel-${id}`}
		aria-labelledby={`tab-${id}`}
		className="w-full flex flex-col items-center"
	>
		{children}
	</div>
);

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
			<main
				id="main-content"
				className="min-h-screen flex flex-col items-center px-4 pt-8 pb-24"
			>
				<header>
					<Logo />
				</header>
				{activeTab === "game" && (
					<TabPanel id="game">
						<GameBoard />
					</TabPanel>
				)}
				{activeTab === "shop" && (
					<TabPanel id="shop">
						<ShopPage />
					</TabPanel>
				)}
				{activeTab === "research" && (
					<TabPanel id="research">
						<ResearchPage />
					</TabPanel>
				)}
				{activeTab === "prestige" && (
					<TabPanel id="prestige">
						<PrestigePage />
					</TabPanel>
				)}
				{activeTab === "settings" && (
					<TabPanel id="settings">
						<SettingsPage
							onReset={() => setActiveTab("game")}
							onWatchIntro={() => setIntroOpen(true)}
						/>
					</TabPanel>
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
