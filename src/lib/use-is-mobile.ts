import { useSyncExternalStore } from "react";

/** Tailwind CSS 4 `md` breakpoint (48rem) */
const TW_MD_BREAKPOINT_PX = 768;

const query =
	typeof window !== "undefined"
		? window.matchMedia(`(max-width: ${TW_MD_BREAKPOINT_PX - 1}px)`)
		: null;

const subscribe = (callback: () => void): (() => void) => {
	query?.addEventListener("change", callback);
	return () => query?.removeEventListener("change", callback);
};

const getSnapshot = (): boolean => query?.matches ?? false;

const getServerSnapshot = (): boolean => false;

export const useIsMobile = (): boolean =>
	useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
