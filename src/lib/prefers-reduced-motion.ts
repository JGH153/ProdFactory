import { useSyncExternalStore } from "react";

const query =
	typeof window !== "undefined"
		? window.matchMedia("(prefers-reduced-motion: reduce)")
		: null;

const subscribe = (callback: () => void): (() => void) => {
	query?.addEventListener("change", callback);
	return () => query?.removeEventListener("change", callback);
};

const getSnapshot = (): boolean => query?.matches ?? false;

const getServerSnapshot = (): boolean => false;

export const usePrefersReducedMotion = (): boolean =>
	useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
