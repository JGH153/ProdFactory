// @vitest-environment happy-dom

import { fireEvent, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { ShopPage } from "@/components/shop-page";
import { createStateWith } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithProviders, screen } from "@/test/render-with-providers";

describe("ShopPage", () => {
	it("renders all boost cards", () => {
		renderWithProviders(<ShopPage />);

		expect(screen.getByText("20x All Production")).toBeInTheDocument();
		expect(screen.getByText("2x Automation Speed")).toBeInTheDocument();
		expect(screen.getByText("50% Run Time Reduction")).toBeInTheDocument();
		expect(screen.getByText("2x Research Speed")).toBeInTheDocument();
	});

	it("shows Activate buttons for inactive boosts", () => {
		renderWithProviders(<ShopPage />);

		const activateButtons = screen.getAllByRole("button", {
			name: "Activate",
		});
		expect(activateButtons).toHaveLength(4);
	});

	it("shows Active state after activating a boost", async () => {
		server.use(
			http.post("/api/game/activate-boost", async ({ request }) => {
				const body = (await request.json()) as {
					boostId: string;
					serverVersion: number;
				};
				return HttpResponse.json({
					state: createStateWith({
						shopBoosts: { [body.boostId]: true },
					}),
					serverVersion: body.serverVersion + 1,
				});
			}),
		);

		renderWithProviders(<ShopPage />);

		const activateButtons = screen.getAllByRole("button", {
			name: "Activate",
		});
		const firstButton = activateButtons[0];
		if (!firstButton) {
			throw new Error("Expected at least one Activate button");
		}
		fireEvent.click(firstButton);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Active" }),
			).toBeInTheDocument();
		});
	});
});
