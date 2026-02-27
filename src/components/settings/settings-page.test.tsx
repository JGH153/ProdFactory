// @vitest-environment happy-dom
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/settings/settings-page";
import { renderWithMusic } from "@/test/render-with-music";

describe("SettingsPage", () => {
	it("renders section headings", () => {
		const { getByText } = renderWithMusic(
			<SettingsPage onReset={vi.fn()} onWatchIntro={vi.fn()} />,
		);

		expect(getByText("Audio")).toBeInTheDocument();
		expect(getByText("General")).toBeInTheDocument();
		expect(getByText("Danger Zone")).toBeInTheDocument();
	});

	it("calls onWatchIntro when Watch Intro Video is clicked", () => {
		const onWatchIntro = vi.fn();
		const { getByRole } = renderWithMusic(
			<SettingsPage onReset={vi.fn()} onWatchIntro={onWatchIntro} />,
		);

		fireEvent.click(getByRole("button", { name: /watch intro video/i }));
		expect(onWatchIntro).toHaveBeenCalled();
	});

	it("shows reset buttons in Danger Zone", () => {
		const { getByRole } = renderWithMusic(
			<SettingsPage onReset={vi.fn()} onWatchIntro={vi.fn()} />,
		);

		expect(
			getByRole("button", { name: /reset shop boosts/i }),
		).toBeInTheDocument();
		expect(getByRole("button", { name: /reset game/i })).toBeInTheDocument();
	});
});
