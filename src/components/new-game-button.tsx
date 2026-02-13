"use client";

import { ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
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

export const NewGameButton = () => {
	const [open, setOpen] = useState(false);
	const { resetGame } = useGameState();

	const handleReset = useCallback(() => {
		resetGame();
		setOpen(false);
	}, [resetGame]);

	return (
		<>
			<Button
				variant="ghost"
				size="icon-sm"
				onClick={() => setOpen(true)}
				title="New game"
				className="text-text-muted hover:text-primary"
			>
				<HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={20} />
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-sm">
					<DialogTitle>Start New Game?</DialogTitle>
					<DialogDescription>
						This will permanently erase all your progress and start from the
						beginning. This action cannot be undone.
					</DialogDescription>
					<div className="flex justify-end gap-2 pt-2">
						<DialogClose asChild>
							<Button variant="secondary">Cancel</Button>
						</DialogClose>
						<Button variant="destructive" onClick={handleReset}>
							Reset Game
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
