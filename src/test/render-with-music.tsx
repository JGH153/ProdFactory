import { QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type PropsWithChildren, type ReactElement, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameStateProvider } from "@/game/state/game-state-context";
import { MilestoneNotificationProvider } from "@/game/state/milestone-context";
import { MusicProvider } from "@/game/state/music-context";
import { SfxProvider } from "@/game/state/sfx-context";
import { createTestQueryClient } from "@/test/render-with-providers";

const AllProvidersWithMusic = ({ children }: PropsWithChildren) => {
	const queryClient = useRef(createTestQueryClient()).current;
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
	const user = userEvent.setup({ pointerEventsCheck: 0 });
	return {
		user,
		...render(ui, { wrapper: AllProvidersWithMusic, ...options }),
	};
};
