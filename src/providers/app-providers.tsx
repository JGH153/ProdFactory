"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AchievementProvider } from "@/game/achievements/achievement-context";
import { GameStateProvider } from "@/game/state/game-state-context";
import { MilestoneNotificationProvider } from "@/game/state/milestone-context";
import { SfxProvider } from "@/game/state/sfx-context";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
			staleTime: Number.POSITIVE_INFINITY,
			refetchOnWindowFocus: false,
		},
		mutations: {
			retry: false,
		},
	},
});

export const AppProviders = ({ children }: PropsWithChildren) => (
	<ErrorBoundary>
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<SfxProvider>
					<MilestoneNotificationProvider>
						<AchievementProvider>
							<GameStateProvider>{children}</GameStateProvider>
						</AchievementProvider>
					</MilestoneNotificationProvider>
				</SfxProvider>
			</TooltipProvider>
		</QueryClientProvider>
	</ErrorBoundary>
);
