// @vitest-environment happy-dom
import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMusic } from "@/game/state/music-context";
import { renderWithMusic } from "@/test/render-with-music";

const MusicTestHarness = () => {
	const { isPlaying, toggle } = useMusic();
	return (
		<div>
			<span data-testid="status">{isPlaying ? "playing" : "paused"}</span>
			<button type="button" onClick={toggle}>
				Toggle
			</button>
		</div>
	);
};

const simulateVisibilityChange = (hidden: boolean) => {
	Object.defineProperty(document, "hidden", {
		value: hidden,
		writable: true,
		configurable: true,
	});
	document.dispatchEvent(new Event("visibilitychange"));
};

describe("MusicContext visibility handling", () => {
	it("pauses audio when tab becomes hidden and resumes when visible", async () => {
		renderWithMusic(<MusicTestHarness />);

		// Start playing
		fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
		await act(() => Promise.resolve());

		expect(screen.getByTestId("status")).toHaveTextContent("playing");

		// Hide tab
		act(() => {
			simulateVisibilityChange(true);
		});

		// isPlaying state stays true (UI still shows playing)
		expect(screen.getByTestId("status")).toHaveTextContent("playing");

		// Show tab again — audio resumes
		act(() => {
			simulateVisibilityChange(false);
		});
		await act(() => Promise.resolve());

		expect(screen.getByTestId("status")).toHaveTextContent("playing");
	});

	it("does not resume audio if user manually paused before hiding", async () => {
		renderWithMusic(<MusicTestHarness />);

		// Start playing
		fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
		await act(() => Promise.resolve());
		expect(screen.getByTestId("status")).toHaveTextContent("playing");

		// User manually pauses
		fireEvent.click(screen.getByRole("button", { name: /toggle/i }));
		expect(screen.getByTestId("status")).toHaveTextContent("paused");

		// Hide then show tab
		act(() => {
			simulateVisibilityChange(true);
		});
		act(() => {
			simulateVisibilityChange(false);
		});
		await act(() => Promise.resolve());

		// Should remain paused — visibility resume should not kick in
		expect(screen.getByTestId("status")).toHaveTextContent("paused");
	});
});
