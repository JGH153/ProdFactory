// @vitest-environment happy-dom
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfflineSummaryModal } from "@/components/offline-summary-modal";
import type { OfflineSummary } from "@/game/types";
import { bigNum } from "@/lib/big-number";
import { renderWithProviders, screen } from "@/test/render-with-providers";

const makeSummary = (
	overrides: Partial<OfflineSummary> = {},
): OfflineSummary => ({
	elapsedSeconds: 3600,
	gains: [{ resourceId: "iron-ore", amount: bigNum(100) }],
	researchLevelUps: [],
	wasCapped: false,
	...overrides,
});

describe("OfflineSummaryModal", () => {
	it("does not render dialog when summary is null", () => {
		renderWithProviders(
			<OfflineSummaryModal summary={null} onCollect={vi.fn()} />,
		);

		expect(
			screen.queryByText("Your factory kept running!"),
		).not.toBeInTheDocument();
	});

	it("renders title and elapsed time when summary is provided", () => {
		renderWithProviders(
			<OfflineSummaryModal summary={makeSummary()} onCollect={vi.fn()} />,
		);

		expect(screen.getByText("Your factory kept running!")).toBeInTheDocument();
		expect(screen.getByText(/1h/)).toBeInTheDocument();
	});

	it("shows resource gains", () => {
		renderWithProviders(
			<OfflineSummaryModal summary={makeSummary()} onCollect={vi.fn()} />,
		);

		expect(screen.getByText("Iron Ore")).toBeInTheDocument();
		expect(screen.getByText("+100")).toBeInTheDocument();
	});

	it("calls onCollect when Collect button is clicked", () => {
		const onCollect = vi.fn();
		renderWithProviders(
			<OfflineSummaryModal summary={makeSummary()} onCollect={onCollect} />,
		);

		fireEvent.click(screen.getByRole("button", { name: /collect/i }));
		expect(onCollect).toHaveBeenCalled();
	});

	it("shows capped message when wasCapped is true", () => {
		renderWithProviders(
			<OfflineSummaryModal
				summary={makeSummary({ wasCapped: true })}
				onCollect={vi.fn()}
			/>,
		);

		expect(screen.getByText(/capped at 8h/i)).toBeInTheDocument();
	});
});
