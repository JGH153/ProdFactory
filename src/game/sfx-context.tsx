"use client";

import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useEffect,
	useState,
} from "react";

const SFX_PREFERENCE_KEY = "prodfactory-sfx-enabled";

const getSfxPreference = (): boolean => {
	try {
		return localStorage.getItem(SFX_PREFERENCE_KEY) !== "false";
	} catch {
		return true;
	}
};

const setSfxPreference = (enabled: boolean): void => {
	try {
		localStorage.setItem(SFX_PREFERENCE_KEY, enabled ? "true" : "false");
	} catch {
		// localStorage might be unavailable
	}
};

type SfxContextValue = {
	sfxEnabled: boolean;
	toggleSfx: () => void;
	playClickSfx: () => void;
	playMilestoneSfx: () => void;
};

const SfxContext = createContext<SfxContextValue | null>(null);

export const SfxProvider = ({ children }: PropsWithChildren) => {
	const [sfxEnabled, setSfxEnabled] = useState(true);

	useEffect(() => {
		setSfxEnabled(getSfxPreference());
	}, []);

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
		audio.volume = 0.4;
		audio.play().catch(() => {
			// Autoplay blocked by browser
		});
	}, [sfxEnabled]);

	const playMilestoneSfx = useCallback(() => {
		if (!sfxEnabled) {
			return;
		}
		const audio = new Audio("/high-speed.mp3");
		audio.volume = 0.5;
		audio.play().catch(() => {
			// Autoplay blocked by browser
		});
	}, [sfxEnabled]);

	return (
		<SfxContext
			value={{ sfxEnabled, toggleSfx, playClickSfx, playMilestoneSfx }}
		>
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
