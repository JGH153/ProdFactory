"use client";

import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";

const INTRO_SEEN_KEY = "prodfactory-intro-seen";

export const INTRO_CLOSED_EVENT = "prodfactory-intro-closed";

export const hasSeenIntro = (): boolean => {
	try {
		return localStorage.getItem(INTRO_SEEN_KEY) === "true";
	} catch {
		return false;
	}
};

const markIntroSeen = (): void => {
	try {
		localStorage.setItem(INTRO_SEEN_KEY, "true");
	} catch {
		// localStorage might be unavailable
	}
};

export const IntroVideoDialog = () => {
	const [open, setOpen] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		if (!hasSeenIntro()) {
			setOpen(true);
		}
	}, []);

	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			markIntroSeen();
			if (videoRef.current) {
				videoRef.current.pause();
			}
			document.dispatchEvent(new CustomEvent(INTRO_CLOSED_EVENT));
		}
	}, []);

	const handleRewatch = useCallback(() => {
		setOpen(true);
	}, []);

	return (
		<>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={handleRewatch}
				title="Watch intro video"
				className="text-text-muted hover:text-primary"
			>
				<HugeiconsIcon icon={PlayCircleIcon} size={20} />
			</Button>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="max-w-3xl p-0 overflow-hidden">
					<div className="p-6 pb-0">
						<DialogTitle>Welcome to ProdFactory</DialogTitle>
						<DialogDescription>
							See how the factory works before you start building.
						</DialogDescription>
					</div>
					<div className="p-4">
						<video
							ref={videoRef}
							className="w-full rounded-lg"
							controls
							preload="metadata"
						>
							<source src="/intro-video.mp4" type="video/mp4" />
							<track kind="captions" />
						</video>
					</div>
					<div className="flex justify-end p-4 pt-0">
						<DialogClose asChild>
							<Button variant="secondary">Close</Button>
						</DialogClose>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
