// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ResourceCard } from "@/components/resource/resource-card";
import { createInitialGameState } from "@/game/initial-state";
import { renderWithProviders, screen } from "@/test/render-with-providers";

describe("ResourceCard", () => {
	it("renders resource name and amount for unlocked resource", () => {
		const state = createInitialGameState();
		renderWithProviders(
			<ResourceCard resource={state.resources["iron-ore"]} />,
		);

		expect(screen.getByText("Iron Ore")).toBeInTheDocument();
		expect(screen.getByText("0")).toBeInTheDocument();
	});

	it("shows buy button with cost", () => {
		const state = createInitialGameState();
		renderWithProviders(
			<ResourceCard resource={state.resources["iron-ore"]} />,
		);

		expect(screen.getByRole("button", { name: /buy x1/i })).toBeInTheDocument();
	});

	it("shows unlock overlay for locked resource", () => {
		const state = createInitialGameState();
		renderWithProviders(<ResourceCard resource={state.resources.plates} />);

		expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
	});

	it("shows automate button for unlocked resource without automation", () => {
		const state = createInitialGameState();
		renderWithProviders(
			<ResourceCard resource={state.resources["iron-ore"]} />,
		);

		expect(
			screen.getByRole("button", { name: /automate/i }),
		).toBeInTheDocument();
	});
});
