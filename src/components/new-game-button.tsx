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

type Props = {
	onReset: () => void;
};

export const NewGameButton = ({ onReset }: Props) => {
	const [open, setOpen] = useState(false);
	const { resetGame } = useGameState();

	const handleReset = useCallback(() => {
		resetGame();
		setOpen(false);
		onReset();
	}, [resetGame, onReset]);

	return (
		<>
			<Button
				variant="destructive"
				onClick={() => setOpen(true)}
				className="w-full"
			>
				<HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={20} />
				Reset Game
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
