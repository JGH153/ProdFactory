"use client";

import { useCallback, useRef } from "react";
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

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export const IntroVideoDialog = ({ open, onOpenChange }: Props) => {
	const videoRef = useRef<HTMLVideoElement>(null);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			onOpenChange(nextOpen);
			if (!nextOpen) {
				markIntroSeen();
				if (videoRef.current) {
					videoRef.current.pause();
				}
				document.dispatchEvent(new CustomEvent(INTRO_CLOSED_EVENT));
			}
		},
		[onOpenChange],
	);

	return (
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
	);
};
