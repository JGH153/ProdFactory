// @vitest-environment happy-dom
import { fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Home from "@/app/page";
import { renderWithProviders, screen } from "@/test/render-with-providers";

describe("Home page", () => {
	beforeEach(() => {
		// Mark intro as seen to prevent the dialog from blocking the UI
		localStorage.setItem("prodfactory-intro-seen", "true");
	});

	it("renders Iron Ore resource on initial load", () => {
		renderWithProviders(<Home />);

		expect(screen.getByText("Iron Ore")).toBeInTheDocument();
	});

	it("shows Game tab as selected by default", () => {
		renderWithProviders(<Home />);

		const gameTab = screen.getByRole("tab", { name: /game/i });
		expect(gameTab).toHaveAttribute("aria-selected", "true");
	});

	it("switches to Research tab when clicked", async () => {
		renderWithProviders(<Home />);

		fireEvent.click(screen.getByRole("tab", { name: /research/i }));

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { level: 2, name: /research/i }),
			).toBeInTheDocument();
		});
	});

	it("switches to Settings tab when clicked", async () => {
		renderWithProviders(<Home />);

		fireEvent.click(screen.getByRole("tab", { name: /settings/i }));

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { level: 2, name: /settings/i }),
			).toBeInTheDocument();
		});
	});
});
