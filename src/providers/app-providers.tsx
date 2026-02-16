"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameStateProvider } from "@/game/game-state-context";
import { MilestoneNotificationProvider } from "@/game/milestone-context";
import { SfxProvider } from "@/game/sfx-context";

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
	<QueryClientProvider client={queryClient}>
		<TooltipProvider>
			<SfxProvider>
				<MilestoneNotificationProvider>
					<GameStateProvider>{children}</GameStateProvider>
				</MilestoneNotificationProvider>
			</SfxProvider>
		</TooltipProvider>
	</QueryClientProvider>
);
