// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { PrestigePage } from "./prestige-page";

describe("PrestigePage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		expect(screen.getByText("FICSIT Evaluation")).toBeInTheDocument();
	});

	it("shows lifetime coupons label", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		expect(screen.getByText("Lifetime Coupons")).toBeInTheDocument();
	});

	it("shows passive bonus label", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		expect(screen.getByText("Passive Bonus")).toBeInTheDocument();
	});

	it("shows times prestiged label", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		expect(screen.getByText("Times Prestiged")).toBeInTheDocument();
	});

	it("shows milestones section", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		expect(screen.getByText("Milestones")).toBeInTheDocument();
		expect(screen.getByText("First Evaluation")).toBeInTheDocument();
	});

	it("disables prestige button when no Nuclear Pasta produced", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		const prestigeButton = screen.getByRole("button", { name: /prestige/i });
		expect(prestigeButton).toBeDisabled();
	});

	it("shows produce Nuclear Pasta message when cannot prestige", () => {
		renderWithProviders(<PrestigePage onPrestigeComplete={() => {}} />);

		expect(
			screen.getByText("Produce Nuclear Pasta to prestige"),
		).toBeInTheDocument();
	});
});
