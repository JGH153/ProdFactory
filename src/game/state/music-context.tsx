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

type MusicTrackId = "gemini" | "gemini-calm" | "classic";

type MusicTrack = {
	id: MusicTrackId;
	label: string;
	src: string;
};

const MUSIC_TRACKS: readonly MusicTrack[] = [
	{ id: "gemini", label: "Gemini", src: "/game-music-gemini.mp3" },
	{
		id: "gemini-calm",
		label: "Gemini Calm",
		src: "/game-music-gemini-calm.mp3",
	},
	{ id: "classic", label: "Classic", src: "/game-music.mp3" },
];

const DEFAULT_TRACK: MusicTrack = {
	id: "gemini",
	label: "Gemini",
	src: "/game-music-gemini.mp3",
};

const MUSIC_PREFERENCE_KEY = "prodfactory-music-playing";
const TRACK_PREFERENCE_KEY = "prodfactory-music-track";

const getMusicPreference = (): boolean => {
	try {
		return localStorage.getItem(MUSIC_PREFERENCE_KEY) !== "false";
	} catch {
		return true;
	}
};

const setMusicPreference = (playing: boolean): void => {
	try {
		localStorage.setItem(MUSIC_PREFERENCE_KEY, playing ? "true" : "false");
	} catch {
		// localStorage might be unavailable
	}
};

const getTrackPreference = (): MusicTrackId => {
	try {
		const stored = localStorage.getItem(TRACK_PREFERENCE_KEY);
		if (stored && MUSIC_TRACKS.some((t) => t.id === stored)) {
			return stored as MusicTrackId;
		}
		return DEFAULT_TRACK.id;
	} catch {
		return DEFAULT_TRACK.id;
	}
};

const setTrackPreference = (trackId: MusicTrackId): void => {
	try {
		localStorage.setItem(TRACK_PREFERENCE_KEY, trackId);
	} catch {
		// localStorage might be unavailable
	}
};

type MusicContextValue = {
	isPlaying: boolean;
	toggle: () => void;
	activeTrackId: MusicTrackId;
	switchTrack: (trackId: MusicTrackId) => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export const MusicProvider = ({ children }: PropsWithChildren) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [activeTrackId, setActiveTrackId] = useState<MusicTrackId>(() =>
		getTrackPreference(),
	);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	const activeTrackIdRef = useRef<MusicTrackId>(getTrackPreference());
	const pendingAutoplayRef = useRef(false);

	const getAudio = useCallback((): HTMLAudioElement => {
		if (!audioRef.current) {
			const track =
				MUSIC_TRACKS.find((t) => t.id === activeTrackIdRef.current) ??
				DEFAULT_TRACK;
			const audio = new Audio(track.src);
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

	const switchTrack = useCallback(
		(trackId: MusicTrackId) => {
			if (trackId === activeTrackIdRef.current) {
				return;
			}
			const wasPlaying = Boolean(audioRef.current && !audioRef.current.paused);
			if (audioRef.current) {
				audioRef.current.pause();
			}
			const track = MUSIC_TRACKS.find((t) => t.id === trackId) ?? DEFAULT_TRACK;
			const audio = getAudio();
			audio.src = track.src;
			audio.load();
			activeTrackIdRef.current = trackId;
			setActiveTrackId(trackId);
			setTrackPreference(trackId);
			if (wasPlaying) {
				audio
					.play()
					.then(() => {
						setIsPlaying(true);
					})
					.catch(() => {
						pendingAutoplayRef.current = true;
					});
			}
		},
		[getAudio],
	);

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

	return (
		<MusicContext value={{ isPlaying, toggle, activeTrackId, switchTrack }}>
			{children}
		</MusicContext>
	);
};

export const useMusic = (): MusicContextValue => {
	const context = use(MusicContext);
	if (!context) {
		throw new Error("useMusic must be used within MusicProvider");
	}
	return context;
};

export { MUSIC_TRACKS };
