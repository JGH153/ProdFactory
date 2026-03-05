// @vitest-environment happy-dom
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { bigNum } from "@/lib/big-number";
import { renderWithProviders, screen } from "@/test/render-with-providers";
import { PrestigeConfirmModal } from "./prestige-confirm-modal";

const defaultProps = {
	open: true,
	onOpenChange: vi.fn(),
	couponsToEarn: bigNum(10),
	currentLifetimeCoupons: bigNum(5),
	streakActive: false,
	couponMagnetLevel: 0,
	isPrestiging: false,
	onConfirm: vi.fn(),
};

describe("PrestigeConfirmModal", () => {
	it("displays coupons to earn", () => {
		renderWithProviders(<PrestigeConfirmModal {...defaultProps} />);

		expect(screen.getByText("+10")).toBeInTheDocument();
	});

	it("displays new lifetime total", () => {
		renderWithProviders(<PrestigeConfirmModal {...defaultProps} />);

		// 5 existing + 10 new = 15
		expect(screen.getByText("15")).toBeInTheDocument();
	});

	it("displays new passive bonus percentage", () => {
		renderWithProviders(<PrestigeConfirmModal {...defaultProps} />);

		// 15 lifetime * 0.10 * 100 = 150%
		expect(screen.getByText("+150%")).toBeInTheDocument();
	});

	it("shows keep and lose lists", () => {
		renderWithProviders(<PrestigeConfirmModal {...defaultProps} />);

		expect(screen.getByText("Research levels")).toBeInTheDocument();
		expect(screen.getByText("Shop boosts")).toBeInTheDocument();
		expect(screen.getByText("Resources")).toBeInTheDocument();
		expect(screen.getByText("Producers")).toBeInTheDocument();
	});

	it("calls onConfirm when Prestige Now is clicked", () => {
		const onConfirm = vi.fn();
		renderWithProviders(
			<PrestigeConfirmModal {...defaultProps} onConfirm={onConfirm} />,
		);

		fireEvent.click(screen.getByRole("button", { name: /prestige now/i }));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("calls onOpenChange(false) when Keep Playing is clicked", () => {
		const onOpenChange = vi.fn();
		renderWithProviders(
			<PrestigeConfirmModal {...defaultProps} onOpenChange={onOpenChange} />,
		);

		fireEvent.click(screen.getByRole("button", { name: /keep playing/i }));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("disables buttons while prestiging", () => {
		renderWithProviders(
			<PrestigeConfirmModal {...defaultProps} isPrestiging={true} />,
		);

		expect(screen.getByRole("button", { name: /prestiging/i })).toBeDisabled();
		expect(
			screen.getByRole("button", { name: /keep playing/i }),
		).toBeDisabled();
	});
});
