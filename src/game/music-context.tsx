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
import {
	hasSeenIntro,
	INTRO_CLOSED_EVENT,
} from "@/components/intro-video-dialog";

const MUSIC_PREF_KEY = "prodfactory-music-playing";

const getMusicPreference = (): boolean => {
	try {
		return localStorage.getItem(MUSIC_PREF_KEY) !== "false";
	} catch {
		return true;
	}
};

const setMusicPreference = (playing: boolean): void => {
	try {
		localStorage.setItem(MUSIC_PREF_KEY, playing ? "true" : "false");
	} catch {
		// localStorage might be unavailable
	}
};

type MusicContextValue = {
	isPlaying: boolean;
	toggle: () => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export const MusicProvider = ({ children }: PropsWithChildren) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const pendingAutoplayRef = useRef(false);

	const getAudio = useCallback((): HTMLAudioElement => {
		if (!audioRef.current) {
			const audio = new Audio("/game-music.mp3");
			audio.loop = true;
			audio.volume = 1;
			audioRef.current = audio;
		}
		return audioRef.current;
	}, []);

	const play = useCallback(() => {
		const audio = getAudio();
		audio
			.play()
			.then(() => {
				setIsPlaying(true);
				setMusicPreference(true);
				pendingAutoplayRef.current = false;
			})
			.catch(() => {
				// Autoplay blocked by browser — will retry on first user interaction
				pendingAutoplayRef.current = true;
			});
	}, [getAudio]);

	const pause = useCallback(() => {
		const audio = getAudio();
		audio.pause();
		setIsPlaying(false);
		setMusicPreference(false);
		pendingAutoplayRef.current = false;
	}, [getAudio]);

	const toggle = useCallback(() => {
		if (isPlaying) {
			pause();
		} else {
			play();
		}
	}, [isPlaying, play, pause]);

	// Return visitor: attempt autoplay if preference is "playing"
	useEffect(() => {
		if (hasSeenIntro() && getMusicPreference()) {
			play();
		}
	}, [play]);

	// Retry music on first user interaction when autoplay was blocked
	useEffect(() => {
		const handleInteraction = () => {
			if (pendingAutoplayRef.current) {
				play();
			}
		};

		const events = ["click", "keydown", "pointerdown"] as const;
		for (const event of events) {
			document.addEventListener(event, handleInteraction, { once: true });
		}
		return () => {
			for (const event of events) {
				document.removeEventListener(event, handleInteraction);
			}
		};
	}, [play]);

	// First visitor: start music when intro dialog closes
	useEffect(() => {
		const handleIntroClosed = () => {
			if (getMusicPreference()) {
				play();
			}
		};

		document.addEventListener(INTRO_CLOSED_EVENT, handleIntroClosed);
		return () => {
			document.removeEventListener(INTRO_CLOSED_EVENT, handleIntroClosed);
		};
	}, [play]);

	// Cleanup audio on unmount
	useEffect(() => {
		return () => {
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current = null;
			}
		};
	}, []);

	return <MusicContext value={{ isPlaying, toggle }}>{children}</MusicContext>;
};

export const useMusic = (): MusicContextValue => {
	const context = use(MusicContext);
	if (!context) {
		throw new Error("useMusic must be used within MusicProvider");
	}
	return context;
};
