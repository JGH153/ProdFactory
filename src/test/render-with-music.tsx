import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactElement } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameStateProvider } from "@/game/state/game-state-context";
import { MilestoneNotificationProvider } from "@/game/state/milestone-context";
import { MusicProvider } from "@/game/state/music-context";
import { SfxProvider } from "@/game/state/sfx-context";
import { createInitialSerializedState } from "@/test/fixtures";

const AllProvidersWithMusic = ({ children }: PropsWithChildren) => {
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
	queryClient.setQueryData(["game", "load"], {
		state: createInitialSerializedState(),
		serverVersion: 1,
	});
	return (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>
				<SfxProvider>
					<MilestoneNotificationProvider>
						<GameStateProvider>
							<MusicProvider>{children}</MusicProvider>
						</GameStateProvider>
					</MilestoneNotificationProvider>
				</SfxProvider>
			</TooltipProvider>
		</QueryClientProvider>
	);
};

export const renderWithMusic = (
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper">,
) => {
	const user = userEvent.setup();
	return {
		user,
		...render(ui, { wrapper: AllProvidersWithMusic, ...options }),
	};
};
