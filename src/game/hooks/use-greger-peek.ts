import { useEffect, useRef, useState } from "react";
import type { ResourceState } from "@/game/types";

const GREGER_TRIGGER_EVERY = 3;
const GREGER_VISIBLE_DURATION_MS = 2000;

type Props = {
	resource: ResourceState;
	onTrigger?: () => void;
};

export const useGregerPeek = ({ resource, onTrigger }: Props): boolean => {
	const [isVisible, setIsVisible] = useState(false);
	const wasRunningRef = useRef(false);
	const manualRunCountRef = useRef(0);

	const isRunning = resource.runStartedAt !== null;
	const isManual = !resource.isAutomated || resource.isPaused;

	useEffect(() => {
		if (wasRunningRef.current && !isRunning && isManual) {
			manualRunCountRef.current += 1;
			if (manualRunCountRef.current % GREGER_TRIGGER_EVERY === 0) {
				setIsVisible(true);
				onTrigger?.();
			}
		}
		wasRunningRef.current = isRunning;
	}, [isRunning, isManual, onTrigger]);

	useEffect(() => {
		if (!isVisible) {
			return;
		}
		const timer = setTimeout(() => {
			setIsVisible(false);
		}, GREGER_VISIBLE_DURATION_MS);
		return () => clearTimeout(timer);
	}, [isVisible]);

	return isVisible;
};
