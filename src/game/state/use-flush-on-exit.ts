"use client";

import { type RefObject, useEffect, useRef } from "react";
import type { GameState } from "@/game/types";
import { saveGame } from "./persistence";
import { serializeGameState } from "./serialization";

export const useFlushOnExit = ({
	stateRef,
	serverVersionRef,
	isReadyRef,
}: {
	stateRef: RefObject<GameState>;
	serverVersionRef: RefObject<number>;
	isReadyRef: RefObject<boolean>;
}): void => {
	// Stable ref so the effect never re-subscribes
	const ctxRef = useRef({ stateRef, serverVersionRef, isReadyRef });
	ctxRef.current = { stateRef, serverVersionRef, isReadyRef };

	useEffect(() => {
		const flushSave = () => {
			if (!ctxRef.current.isReadyRef.current) {
				return;
			}
			saveGame(ctxRef.current.stateRef.current);
			const serialized = serializeGameState(ctxRef.current.stateRef.current);
			const blob = new Blob(
				[
					JSON.stringify({
						state: serialized,
						serverVersion: ctxRef.current.serverVersionRef.current,
					}),
				],
				{ type: "application/json" },
			);
			navigator.sendBeacon("/api/game/save", blob);
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				flushSave();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);
};
