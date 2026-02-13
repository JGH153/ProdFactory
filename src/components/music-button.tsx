"use client";

import { MusicNote03Icon, VolumeMute02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	hasSeenIntro,
	INTRO_CLOSED_EVENT,
} from "@/components/intro-video-dialog";
import { Button } from "@/components/ui/button";
import { useMuteShortcut } from "@/game/use-mute-shortcut";

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

export const MusicButton = () => {
	const [isPlaying, setIsPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

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
			})
			.catch(() => {
				// Autoplay blocked by browser — user can click the button manually
			});
	}, [getAudio]);

	const pause = useCallback(() => {
		const audio = getAudio();
		audio.pause();
		setIsPlaying(false);
		setMusicPreference(false);
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

	useMuteShortcut(toggle);

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
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={toggle}
			title={isPlaying ? "Pause music (M)" : "Play music (M)"}
			className="text-text-muted hover:text-primary"
		>
			<HugeiconsIcon
				icon={isPlaying ? MusicNote03Icon : VolumeMute02Icon}
				size={20}
			/>
		</Button>
	);
};
