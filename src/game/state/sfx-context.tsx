"use client";

import {
	createContext,
	type PropsWithChildren,
	use,
	useCallback,
	useEffect,
	useRef,
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
	playGregerSfx: () => void;
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

	const audioPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());

	const playSound = useCallback(
		(src: string, volume: number) => {
			if (!sfxEnabled) {
				return;
			}
			let audio = audioPoolRef.current.get(src);
			if (!audio) {
				audio = new Audio(src);
				audioPoolRef.current.set(src, audio);
			}
			audio.volume = volume;
			audio.currentTime = 0;
			audio.play().catch(() => {
				// Autoplay blocked by browser
				console.log("[SFX] Autoplay blocked by browser");
			});
		},
		[sfxEnabled],
	);

	const playClickSfx = useCallback(() => {
		playSound("/pickaxe.mp3", 0.3);
	}, [playSound]);

	const playMilestoneSfx = useCallback(() => {
		playSound("/high-speed.mp3", 0.2);
	}, [playSound]);

	const playGregerSfx = useCallback(() => {
		playSound("/nice.mp3", 0.2);
	}, [playSound]);

	return (
		<SfxContext
			value={{
				sfxEnabled,
				toggleSfx,
				playClickSfx,
				playMilestoneSfx,
				playGregerSfx,
			}}
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
