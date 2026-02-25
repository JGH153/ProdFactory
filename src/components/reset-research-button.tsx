"use client";

import { TestTubeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { useGameState } from "@/game/game-state-context";

export const ResetResearchButton = () => {
	const [open, setOpen] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const { resetResearch } = useGameState();

	const handleReset = useCallback(async () => {
		setIsResetting(true);
		const success = await resetResearch();
		setIsResetting(false);
		if (success) {
			setOpen(false);
		}
	}, [resetResearch]);

	return (
		<>
			<Button
				variant="destructive"
				onClick={() => setOpen(true)}
				className="w-full"
			>
				<HugeiconsIcon icon={TestTubeIcon} size={20} />
				Reset Research
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-sm">
					<DialogTitle>Reset Research?</DialogTitle>
					<DialogDescription>
						This will reset all research levels to zero and lock all labs. Your
						resources, producers, and shop boosts will not be affected.
					</DialogDescription>
					<div className="flex justify-end gap-2 pt-2">
						<DialogClose asChild>
							<Button variant="secondary" disabled={isResetting}>
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant="destructive"
							onClick={handleReset}
							disabled={isResetting}
						>
							{isResetting ? (
								<>
									<span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
									Resetting...
								</>
							) : (
								"Reset Research"
							)}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
