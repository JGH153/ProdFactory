"use client";

import { Store04Icon } from "@hugeicons/core-free-icons";
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

export const ResetShopButton = () => {
	const [open, setOpen] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const { resetShopBoosts } = useGameState();

	const handleReset = useCallback(async () => {
		setIsResetting(true);
		const success = await resetShopBoosts();
		setIsResetting(false);
		if (success) {
			setOpen(false);
		}
	}, [resetShopBoosts]);

	return (
		<>
			<Button
				variant="destructive"
				onClick={() => setOpen(true)}
				className="w-full"
			>
				<HugeiconsIcon icon={Store04Icon} size={20} />
				Reset Shop Boosts
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-sm">
					<DialogTitle>Reset Shop Boosts?</DialogTitle>
					<DialogDescription>
						This will deactivate all shop boosts. You can re-activate them at
						any time from the shop.
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
								"Reset Boosts"
							)}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
};
