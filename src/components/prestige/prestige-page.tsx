"use client";

import { Rocket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { computeCouponsEarned } from "@/game/logic";
import {
	COUPON_BONUS_PER_UNIT,
	getPrestigePassiveMultiplier,
} from "@/game/prestige-config";
import { useGameState } from "@/game/state/game-state-context";
import { bnFormat, bnIsZero, bnToNumber } from "@/lib/big-number";
import { PrestigeConfirmModal } from "./prestige-confirm-modal";
import { PrestigeMilestones } from "./prestige-milestones";

type SuccessInfo = {
	couponsEarned: string;
	newBonusPercent: number;
};

export const PrestigePage = () => {
	const { state, prestige: doPrestige } = useGameState();
	const [showConfirm, setShowConfirm] = useState(false);
	const [isPrestiging, setIsPrestiging] = useState(false);
	const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
	const successTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

	const { prestige } = state;
	const passiveMultiplier = getPrestigePassiveMultiplier({
		lifetimeCoupons: prestige.lifetimeCoupons,
	});
	const passiveBonusPercent = Math.round((passiveMultiplier - 1) * 100);
	const couponsToEarn = computeCouponsEarned({
		nuclearPastaProducedThisRun: prestige.nuclearPastaProducedThisRun,
	});
	const canPrestigeNow = !bnIsZero(prestige.nuclearPastaProducedThisRun);

	useEffect(() => {
		return () => {
			if (successTimerRef.current) {
				clearTimeout(successTimerRef.current);
			}
		};
	}, []);

	const handlePrestige = useCallback(async () => {
		const earnedStr = bnFormat(couponsToEarn);
		const newLifetimeCoupons =
			bnToNumber(prestige.lifetimeCoupons) + bnToNumber(couponsToEarn);
		const newBonus = Math.round(
			newLifetimeCoupons * COUPON_BONUS_PER_UNIT * 100,
		);

		setIsPrestiging(true);
		const success = await doPrestige();
		setIsPrestiging(false);
		setShowConfirm(false);

		if (success) {
			setSuccessInfo({ couponsEarned: earnedStr, newBonusPercent: newBonus });
			successTimerRef.current = setTimeout(() => {
				setSuccessInfo(null);
			}, 3000);
		}
	}, [doPrestige, couponsToEarn, prestige.lifetimeCoupons]);

	const dismissSuccess = useCallback(() => {
		setSuccessInfo(null);
		if (successTimerRef.current) {
			clearTimeout(successTimerRef.current);
		}
	}, []);

	return (
		<div className="w-full max-w-lg flex flex-col gap-6">
			<h2 className="text-2xl font-bold text-text-primary">
				FICSIT Evaluation
			</h2>

			<AnimatePresence mode="wait">
				{successInfo ? (
					<motion.div
						key="success"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.3 }}
						className="flex flex-col items-center gap-4 py-8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:rounded-lg"
						role="button"
						tabIndex={0}
						onClick={dismissSuccess}
						onKeyDown={(e: React.KeyboardEvent) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								dismissSuccess();
							}
						}}
						aria-label="Dismiss success message"
					>
						<motion.div
							initial={{ scale: 0 }}
							animate={{ scale: 1 }}
							transition={{
								type: "spring",
								stiffness: 300,
								damping: 20,
								delay: 0.1,
							}}
						>
							<HugeiconsIcon
								icon={Rocket01Icon}
								size={48}
								className="text-accent-amber"
								aria-hidden="true"
							/>
						</motion.div>
						<motion.p
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							className="text-2xl font-bold text-accent-amber"
						>
							+{successInfo.couponsEarned} Coupons!
						</motion.p>
						<motion.p
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.35 }}
							className="text-sm text-text-muted"
						>
							Passive bonus: +{successInfo.newBonusPercent}% all production
						</motion.p>
					</motion.div>
				) : (
					<motion.div
						key="normal"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="flex flex-col gap-6"
					>
						{/* Status Bar */}
						<Card>
							<CardContent className="flex flex-col gap-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-text-muted">Lifetime Coupons</span>
									<span className="font-semibold text-accent-amber">
										{bnFormat(prestige.lifetimeCoupons)}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-text-muted">Coupon Balance</span>
									<span className="font-medium text-text-primary">
										{bnFormat(prestige.couponBalance)}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-text-muted">Passive Bonus</span>
									<span className="font-medium text-text-primary">
										{passiveBonusPercent > 0
											? `+${passiveBonusPercent}% all production`
											: "None yet"}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-text-muted">Times Prestiged</span>
									<span className="font-medium text-text-primary">
										{prestige.prestigeCount}
									</span>
								</div>
							</CardContent>
						</Card>

						{/* Prestige Button */}
						<Card>
							<CardContent className="flex flex-col items-center gap-3">
								<div className="flex items-center gap-2">
									<HugeiconsIcon
										icon={Rocket01Icon}
										size={24}
										className="text-accent-amber"
										aria-hidden="true"
									/>
									<span className="text-sm font-medium text-text-muted">
										{canPrestigeNow
											? `Prestige for ${bnFormat(couponsToEarn)} coupons`
											: "Produce Nuclear Pasta to prestige"}
									</span>
								</div>
								<Button
									size="lg"
									className="w-full"
									disabled={!canPrestigeNow}
									onClick={() => setShowConfirm(true)}
								>
									Open Prestige Menu
								</Button>
							</CardContent>
						</Card>

						{/* Milestones */}
						<PrestigeMilestones prestigeCount={prestige.prestigeCount} />
					</motion.div>
				)}
			</AnimatePresence>

			<PrestigeConfirmModal
				open={showConfirm}
				onOpenChange={setShowConfirm}
				couponsToEarn={couponsToEarn}
				currentLifetimeCoupons={prestige.lifetimeCoupons}
				isPrestiging={isPrestiging}
				onConfirm={handlePrestige}
			/>
		</div>
	);
};
