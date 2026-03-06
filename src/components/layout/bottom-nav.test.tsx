// @vitest-environment happy-dom
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/layout/bottom-nav";
import { runAxe } from "@/test/axe-helper";
import { renderWithProviders, screen } from "@/test/render-with-providers";

describe("BottomNav", () => {
	it("renders all tab labels", () => {
		renderWithProviders(<BottomNav activeTab="game" onTabChange={vi.fn()} />);

		expect(screen.getByText("Game")).toBeInTheDocument();
		expect(screen.getByText("Shop")).toBeInTheDocument();
		expect(screen.getByText("Research")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("marks the active tab with aria-selected", () => {
		renderWithProviders(
			<BottomNav activeTab="settings" onTabChange={vi.fn()} />,
		);

		const settingsTab = screen.getByRole("tab", { name: /settings/i });
		expect(settingsTab).toHaveAttribute("aria-selected", "true");
	});

	it("calls onTabChange when a tab is clicked", () => {
		const onTabChange = vi.fn();
		renderWithProviders(
			<BottomNav activeTab="game" onTabChange={onTabChange} />,
		);

		fireEvent.click(screen.getByRole("tab", { name: /settings/i }));
		expect(onTabChange).toHaveBeenCalledWith("settings");
	});

	it("shows research tab as locked when reinforced plates are not unlocked", () => {
		renderWithProviders(<BottomNav activeTab="game" onTabChange={vi.fn()} />);

		const researchTab = screen.getByRole("tab", { name: /research/i });
		expect(researchTab).toHaveAttribute("aria-disabled");
	});

	it("has no accessibility violations", async () => {
		const { container } = renderWithProviders(
			<BottomNav activeTab="game" onTabChange={vi.fn()} />,
		);

		expect(
			await runAxe(container, {
				rules: {
					// Tab panels live in page.tsx, not in this component
					"aria-valid-attr-value": { enabled: false },
				},
			}),
		).toHaveNoViolations();
	});

	it("shows shop tab as locked when plates are not unlocked", () => {
		renderWithProviders(<BottomNav activeTab="game" onTabChange={vi.fn()} />);

		const shopTab = screen.getByRole("tab", { name: /shop/i });
		expect(shopTab).toHaveAttribute("aria-disabled");
	});
});
