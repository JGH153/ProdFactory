import { afterAll, afterEach, beforeAll, vi } from "vitest";

// --- Component test setup (DOM environments only) ---
const isDOM = typeof window !== "undefined";

if (isDOM) {
	const { default: failOnConsole } = await import("vitest-fail-on-console");

	failOnConsole({
		shouldFailOnError: true,
		shouldFailOnWarn: true,
		shouldFailOnLog: false,
		shouldFailOnDebug: false,
	});
	await import("react");
	const { cleanup } = await import("@testing-library/react");
	const { server } = await import("./msw-server");

	await import("@testing-library/jest-dom/vitest");

	// MSW lifecycle
	beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
	afterEach(() => {
		cleanup();
		server.resetHandlers();
		localStorage.clear();
	});
	afterAll(() => server.close());

	// Mock: motion/react
	vi.mock("motion/react", () => {
		const ReactMod = require("react");
		const createMotionProxy = () =>
			new Proxy(
				{},
				{
					get(_target: object, prop: string) {
						return ReactMod.forwardRef(
							(props: Record<string, unknown>, ref: unknown) => {
								const {
									animate,
									initial,
									exit,
									transition,
									variants,
									whileHover,
									whileTap,
									whileFocus,
									whileDrag,
									whileInView,
									layout,
									layoutId,
									onAnimationStart,
									onAnimationComplete,
									...rest
								} = props;
								return ReactMod.createElement(prop, { ...rest, ref });
							},
						);
					},
				},
			);

		return {
			motion: createMotionProxy(),
			AnimatePresence: ({
				children,
			}: {
				children: typeof ReactMod.ReactNode;
			}) => children,
			useAnimation: () => ({
				start: vi.fn(),
				stop: vi.fn(),
				set: vi.fn(),
			}),
			useInView: () => true,
			useMotionValue: (v: number) => ({
				get: () => v,
				set: vi.fn(),
				onChange: vi.fn(),
			}),
		};
	});

	// Mock: Audio
	class MockAudio {
		src = "";
		volume = 1;
		loop = false;
		paused = true;
		play() {
			this.paused = false;
			return Promise.resolve();
		}
		pause() {
			this.paused = true;
		}
		load() {}
		addEventListener() {}
		removeEventListener() {}
	}
	vi.stubGlobal("Audio", MockAudio);

	// Prevent the game tick RAF loop from running continuously in tests
	vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
	vi.stubGlobal("cancelAnimationFrame", (_id: number) => {});
}
