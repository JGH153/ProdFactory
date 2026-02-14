"use client";

import {
	DashboardSpeed01Icon,
	Rocket01Icon,
	Timer01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useGameState } from "@/game/game-state-context";
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
		description: "Double the output of all resource production runs.",
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
];

export const ShopPage = () => {
	const { state, activateShopBoost } = useGameState();
	const [activatingId, setActivatingId] = useState<ShopBoostId | null>(null);

	const handleActivate = async (boostId: ShopBoostId) => {
		setActivatingId(boostId);
		await activateShopBoost(boostId);
		setActivatingId(null);
	};

	return (
		<div className="w-full max-w-lg flex flex-col gap-6">
			<h2 className="text-2xl font-bold text-text-primary">Shop</h2>
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
											<HugeiconsIcon icon={multiplier.icon} size={28} />
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
													<span className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
	);
};
