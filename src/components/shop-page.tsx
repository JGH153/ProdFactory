"use client";

import {
	DashboardSpeed01Icon,
	Forward02Icon,
	InformationCircleIcon,
	Moon02Icon,
	Rocket01Icon,
	TestTubeIcon,
	Timer01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useGameState } from "@/game/state/game-state-context";
import type { ShopBoostId } from "@/game/types";

const SHOP_MULTIPLIERS: ReadonlyArray<{
	id: ShopBoostId;
	name: string;
	description: string;
	icon: typeof Rocket01Icon;
	colorClass: string;
}> = [
	{
		id: "production-2x",
		name: "2x All Production",
		description: "Multiply the output of all resource production runs by 2.",
		icon: Rocket01Icon,
		colorClass: "text-primary",
	},
	{
		id: "automation-2x",
		name: "2x Automation Speed",
		description: "Automated runs complete twice as fast.",
		icon: DashboardSpeed01Icon,
		colorClass: "text-accent-amber",
	},
	{
		id: "runtime-50",
		name: "50% Run Time Reduction",
		description: "All run timers are cut in half.",
		icon: Timer01Icon,
		colorClass: "text-success",
	},
	{
		id: "research-2x",
		name: "2x Research Speed",
		description: "All research completes twice as fast.",
		icon: TestTubeIcon,
		colorClass: "text-accent-amber",
	},
	{
		id: "offline-2h",
		name: "Offline +2h",
		description: "Increase offline progress cap by 2 hours.",
		icon: Moon02Icon,
		colorClass: "text-primary",
	},
];

export const ShopPage = () => {
	const { state, activateShopBoost, timeWarp } = useGameState();
	const [activatingId, setActivatingId] = useState<ShopBoostId | null>(null);
	const [isWarping, setIsWarping] = useState(false);
	const [showWarpFlash, setShowWarpFlash] = useState(false);
	const flashTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

	const handleActivate = async (boostId: ShopBoostId) => {
		setActivatingId(boostId);
		await activateShopBoost(boostId);
		setActivatingId(null);
	};

	const handleTimeWarp = async () => {
		setIsWarping(true);
		const success = await timeWarp();
		if (success) {
			setShowWarpFlash(true);
			if (flashTimerRef.current) {
				clearTimeout(flashTimerRef.current);
			}
			flashTimerRef.current = setTimeout(() => setShowWarpFlash(false), 600);
		}
		setIsWarping(false);
	};

	return (
		<div className="w-full max-w-lg flex flex-col gap-6">
			<h2 className="text-2xl font-bold text-text-primary">Shop</h2>

			<Alert>
				<HugeiconsIcon
					icon={InformationCircleIcon}
					size={16}
					aria-hidden="true"
				/>
				<AlertTitle>Limited Time</AlertTitle>
				<AlertDescription>
					All shop items are free for a limited time.
				</AlertDescription>
			</Alert>

			<div className="flex flex-col gap-2">
				<h3 className="text-lg font-semibold text-text-secondary">
					One Time Upgrades
				</h3>
				<motion.div
					className="flex flex-col gap-4"
					initial="hidden"
					animate="visible"
					variants={{
						hidden: {},
						visible: { transition: { staggerChildren: 0.1 } },
					}}
				>
					{SHOP_MULTIPLIERS.map((multiplier) => {
						const isActive = state.shopBoosts[multiplier.id];
						const isActivating = activatingId === multiplier.id;
						return (
							<motion.div
								key={multiplier.id}
								variants={{
									hidden: { opacity: 0, y: 20 },
									visible: { opacity: 1, y: 0 },
								}}
							>
								<Card
									className={isActive ? "border-success/50 bg-success/5" : ""}
								>
									<CardHeader>
										<div className="flex items-center gap-3">
											<div
												className={
													isActive ? "text-success" : multiplier.colorClass
												}
											>
												<HugeiconsIcon
													icon={multiplier.icon}
													size={28}
													aria-hidden="true"
												/>
											</div>
											<div>
												<CardTitle>{multiplier.name}</CardTitle>
												<CardDescription>
													{multiplier.description}
												</CardDescription>
											</div>
										</div>
									</CardHeader>
									<CardContent>
										{isActive ? (
											<Button
												disabled
												className="w-full bg-success/20 text-success border-success/30"
											>
												Active
											</Button>
										) : (
											<Button
												className="w-full"
												onClick={() => handleActivate(multiplier.id)}
												disabled={activatingId !== null}
											>
												{isActivating ? (
													<>
														<Spinner />
														Activating...
													</>
												) : (
													"Activate"
												)}
											</Button>
										)}
									</CardContent>
								</Card>
							</motion.div>
						);
					})}
				</motion.div>
			</div>

			<div className="flex flex-col gap-2">
				<h3 className="text-lg font-semibold text-text-secondary">
					Repeatable Purchases
				</h3>
				<motion.div
					initial="hidden"
					animate="visible"
					variants={{
						hidden: {},
						visible: { transition: { staggerChildren: 0.1 } },
					}}
				>
					<motion.div
						variants={{
							hidden: { opacity: 0, y: 20 },
							visible: { opacity: 1, y: 0 },
						}}
					>
						<Card className="relative overflow-hidden border-accent-amber/50">
							<AnimatePresence>
								{showWarpFlash && (
									<motion.div
										className="absolute inset-0 bg-accent-amber/20 pointer-events-none"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: 0.6 }}
									/>
								)}
							</AnimatePresence>
							<CardHeader>
								<div className="flex items-center gap-3">
									<div className="text-accent-amber">
										<HugeiconsIcon
											icon={Forward02Icon}
											size={28}
											aria-hidden="true"
										/>
									</div>
									<div>
										<CardTitle>Time Warp</CardTitle>
										<CardDescription>
											Jump forward 1 hour — gain resources and research as if
											time passed.
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<Button
									className="w-full"
									onClick={handleTimeWarp}
									disabled={isWarping}
								>
									{isWarping ? (
										<>
											<Spinner />
											Warping...
										</>
									) : (
										"Activate"
									)}
								</Button>
							</CardContent>
						</Card>
					</motion.div>
				</motion.div>
			</div>
		</div>
	);
};
