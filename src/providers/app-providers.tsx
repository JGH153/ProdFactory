"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { GameStateProvider } from "@/game/game-state-context";

const queryClient = new QueryClient();

export const AppProviders = ({ children }: PropsWithChildren) => (
	<QueryClientProvider client={queryClient}>
		<GameStateProvider>{children}</GameStateProvider>
	</QueryClientProvider>
);
