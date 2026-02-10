"use client";

import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useState,
} from "react";

const SFX_PREF_KEY = "prodfactory-sfx-enabled";

const getSfxPreference = (): boolean => {
	try {
		return localStorage.getItem(SFX_PREF_KEY) !== "false";
	} catch {
		return true;
	}
};

const setSfxPreference = (enabled: boolean): void => {
	try {
		localStorage.setItem(SFX_PREF_KEY, enabled ? "true" : "false");
	} catch {
		// localStorage might be unavailable
	}
};

type SfxContextValue = {
	sfxEnabled: boolean;
	toggleSfx: () => void;
	playClickSfx: () => void;
};

const SfxContext = createContext<SfxContextValue | null>(null);

export const SfxProvider = ({ children }: PropsWithChildren) => {
	const [sfxEnabled, setSfxEnabled] = useState(getSfxPreference);

	const toggleSfx = useCallback(() => {
		setSfxEnabled((prev) => {
			const next = !prev;
			setSfxPreference(next);
			return next;
		});
	}, []);

	const playClickSfx = useCallback(() => {
		if (!sfxEnabled) {
			return;
		}
		const audio = new Audio("/pickaxe.mp3");
		audio.play().catch(() => {
			// Autoplay blocked by browser
		});
	}, [sfxEnabled]);

	return (
		<SfxContext value={{ sfxEnabled, toggleSfx, playClickSfx }}>
			{children}
		</SfxContext>
	);
};

export const useSfx = (): SfxContextValue => {
	const context = use(SfxContext);
	if (!context) {
		throw new Error("useSfx must be used within SfxProvider");
	}
	return context;
};
