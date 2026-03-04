// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResourceState } from "@/game/types";
import { useGregerPeek } from "./use-greger-peek";

const makeResource = (
	overrides: Partial<ResourceState> = {},
): ResourceState => ({
	id: "iron-ore",
	amount: { mantissa: 0, exponent: 0 },
	producers: 1,
	isUnlocked: true,
	isAutomated: false,
	isPaused: false,
	runStartedAt: null,
	...overrides,
});

type HookProps = {
	resource: ResourceState;
	onTrigger?: () => void;
};

const simulateRunCompletions = (
	resource: ResourceState,
	count: number,
	rerender: (props: HookProps) => void,
	onTrigger?: () => void,
) => {
	const triggerProp = onTrigger ? { onTrigger } : {};
	for (let i = 0; i < count; i++) {
		act(() => {
			rerender({
				resource: { ...resource, runStartedAt: Date.now() },
				...triggerProp,
			});
		});
		act(() => {
			rerender({
				resource: { ...resource, runStartedAt: null },
				...triggerProp,
			});
		});
	}
};

describe("useGregerPeek", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns false initially", () => {
		const { result } = renderHook(() =>
			useGregerPeek({ resource: makeResource() }),
		);
		expect(result.current).toBe(false);
	});

	it("does not trigger before 3rd completion", () => {
		const resource = makeResource();
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 2, rerender);
		expect(result.current).toBe(false);
	});

	it("triggers on 3rd manual completion", () => {
		const resource = makeResource();
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 3, rerender);
		expect(result.current).toBe(true);
	});

	it("works for any resource", () => {
		const resource = makeResource({ id: "plates" });
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 3, rerender);
		expect(result.current).toBe(true);
	});

	it("does not count automated completions", () => {
		const resource = makeResource({ isAutomated: true, isPaused: false });
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 6, rerender);
		expect(result.current).toBe(false);
	});

	it("counts paused-automation completions as manual", () => {
		const resource = makeResource({ isAutomated: true, isPaused: true });
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 3, rerender);
		expect(result.current).toBe(true);
	});

	it("auto-resets after timeout", () => {
		const resource = makeResource();
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 3, rerender);
		expect(result.current).toBe(true);

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current).toBe(false);
	});

	it("cycles: triggers again on 6th completion", () => {
		const resource = makeResource();
		const { result, rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource } },
		);

		simulateRunCompletions(resource, 3, rerender);
		expect(result.current).toBe(true);

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current).toBe(false);

		simulateRunCompletions(resource, 3, rerender);
		expect(result.current).toBe(true);
	});

	it("calls onTrigger on every 3rd manual completion", () => {
		const resource = makeResource();
		const onTrigger = vi.fn<() => void>();
		const { rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource, onTrigger } as HookProps },
		);

		simulateRunCompletions(resource, 3, rerender, onTrigger);
		expect(onTrigger).toHaveBeenCalledTimes(1);

		act(() => {
			vi.advanceTimersByTime(2000);
		});

		simulateRunCompletions(resource, 3, rerender, onTrigger);
		expect(onTrigger).toHaveBeenCalledTimes(2);
	});

	it("does not call onTrigger on non-trigger completions", () => {
		const resource = makeResource();
		const onTrigger = vi.fn<() => void>();
		const { rerender } = renderHook(
			(props: HookProps) => useGregerPeek(props),
			{ initialProps: { resource, onTrigger } as HookProps },
		);

		simulateRunCompletions(resource, 2, rerender, onTrigger);
		expect(onTrigger).not.toHaveBeenCalled();
	});
});
