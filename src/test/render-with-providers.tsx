import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type PropsWithChildren, type ReactElement, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AchievementProvider } from "@/game/achievements/achievement-context";
import { GameStateProvider } from "@/game/state/game-state-context";
import { MilestoneNotificationProvider } from "@/game/state/milestone-context";
import { SfxProvider } from "@/game/state/sfx-context";
import { createInitialSerializedState } from "@/test/fixtures";

export const createTestQueryClient = () => {
	const client = new QueryClient({
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
	client.setQueryData(["game", "load"], {
		state: createInitialSerializedState(),
		serverVersion: 1,
	});
	return client;
};

const AllProviders = ({ children }: PropsWithChildren) => {
	const queryClient = useRef(createTestQueryClient()).current;
	return (
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
	);
};

export const renderWithProviders = (
	ui: ReactElement,
	options?: Omit<RenderOptions, "wrapper">,
) => {
	const user = userEvent.setup({ pointerEventsCheck: 0 });
	return {
		user,
		...render(ui, { wrapper: AllProviders, ...options }),
	};
};

export { screen } from "@testing-library/react";
