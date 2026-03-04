// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ResearchPage } from "@/components/research/research-page";
import { renderWithProviders, screen } from "@/test/render-with-providers";

describe("ResearchPage", () => {
	it("renders the Research heading", () => {
		renderWithProviders(<ResearchPage />);

		expect(
			screen.getByRole("heading", { level: 2, name: /research/i }),
		).toBeInTheDocument();
	});

	it("renders Labs section with lab cards", () => {
		renderWithProviders(<ResearchPage />);

		expect(screen.getByText("Labs")).toBeInTheDocument();
		expect(screen.getByText("Lab 1")).toBeInTheDocument();
		expect(screen.getByText("Lab 2")).toBeInTheDocument();
	});

	it("renders Efficiency Research section", () => {
		renderWithProviders(<ResearchPage />);

		expect(screen.getByText("Efficiency Research")).toBeInTheDocument();
		expect(screen.getByText("Iron Ore Efficiency")).toBeInTheDocument();
		expect(screen.getByText("Plate Efficiency")).toBeInTheDocument();
	});

	it("renders Speed Research section", () => {
		renderWithProviders(<ResearchPage />);

		expect(screen.getByText("Speed Research")).toBeInTheDocument();
		expect(screen.getByText("Iron Ore Speed")).toBeInTheDocument();
		expect(screen.getByText("Plate Speed")).toBeInTheDocument();
	});

	it("shows Unlock (Free) button for lab-1 when locked", () => {
		renderWithProviders(<ResearchPage />);

		const unlockButtons = screen.getAllByRole("button", {
			name: /unlock \(free\)/i,
		});
		expect(unlockButtons).toHaveLength(1);
	});

	it("shows Requires Prestige for lab-2 when prestige count is 0", () => {
		renderWithProviders(<ResearchPage />);

		expect(screen.getByText("Requires Prestige")).toBeInTheDocument();
	});
});
