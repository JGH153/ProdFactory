"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { useGameState } from "@/game/state/game-state-context";
import { useMilestoneNotification } from "@/game/state/milestone-context";
import { MusicProvider } from "@/game/state/music-context";
import { IS_DEV_MODE } from "@/lib/env-frontend";

type ActiveTab = "game" | "shop" | "research" | "prestige" | "settings";

const VALID_TABS: ReadonlySet<string> = new Set<ActiveTab>([
	"game",
	"shop",
	"research",
	"prestige",
	"settings",
]);

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

const HomeContent = () => {
	const searchParams = useSearchParams();
	const tabParam = searchParams.get("tab");
	const activeTab: ActiveTab =
		tabParam !== null && VALID_TABS.has(tabParam)
			? (tabParam as ActiveTab)
			: "game";
	const [introOpen, setIntroOpen] = useState(false);
	const { offlineSummary, collectOfflineProgress, devBoost } = useGameState();
	const { registerNavigate } = useMilestoneNotification();

	const changeTab = useCallback((tab: ActiveTab) => {
		const url = tab === "game" ? "/" : `?tab=${tab}`;
		window.history.replaceState(null, "", url);
	}, []);

	useEffect(() => {
		registerNavigate(changeTab);
	}, [registerNavigate, changeTab]);

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
				<header className="flex items-center gap-3">
					<Logo />
					{IS_DEV_MODE && (
						<Button variant="secondary" size="xs" onClick={() => devBoost()}>
							DEV BOOST
						</Button>
					)}
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
						<PrestigePage onPrestigeComplete={() => changeTab("game")} />
					</TabPanel>
				)}
				{activeTab === "settings" && (
					<TabPanel id="settings">
						<SettingsPage
							onReset={() => changeTab("game")}
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
			<BottomNav activeTab={activeTab} onTabChange={changeTab} />
		</MusicProvider>
	);
};

export default function Home() {
	return (
		<Suspense>
			<HomeContent />
		</Suspense>
	);
}
