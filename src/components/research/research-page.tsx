"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	EFFICIENCY_RESEARCH_ORDER,
	LAB_ORDER,
	SPEED_RESEARCH_ORDER,
} from "@/game/research-config";
import type { LabId } from "@/game/types";
import { LabCard } from "./lab-card";
import { ResearchItemCard } from "./research-item-card";
import { ResearchPickerDialog } from "./research-picker-dialog";

export const ResearchPage = () => {
	const [pickerLabId, setPickerLabId] = useState<LabId | null>(null);

	return (
		<div className="w-full max-w-lg flex flex-col gap-6">
			<h2 className="text-2xl font-bold text-text-primary">Research</h2>

			<motion.div
				initial="hidden"
				animate="visible"
				variants={{
					hidden: {},
					visible: { transition: { staggerChildren: 0.1 } },
				}}
				className="flex flex-col gap-4"
			>
				{/* Labs section */}
				<motion.div
					variants={{
						hidden: { opacity: 0, y: 20 },
						visible: { opacity: 1, y: 0 },
					}}
				>
					<h3 className="text-sm font-semibold text-text-secondary mb-3">
						Labs
					</h3>
					<div className="grid grid-cols-2 gap-3">
						{LAB_ORDER.map((labId, index) => (
							<LabCard
								key={labId}
								labId={labId}
								labIndex={index + 1}
								onAssign={() => setPickerLabId(labId)}
							/>
						))}
					</div>
				</motion.div>

				{/* Efficiency research section */}
				<motion.div
					variants={{
						hidden: { opacity: 0, y: 20 },
						visible: { opacity: 1, y: 0 },
					}}
				>
					<h3 className="text-sm font-semibold text-text-secondary mb-3">
						Efficiency Research
					</h3>
					<Alert className="mb-3">
						<HugeiconsIcon
							icon={InformationCircleIcon}
							size={16}
							aria-hidden="true"
						/>
						<AlertDescription>
							Unlock a resource in the game to research its efficiency.
						</AlertDescription>
					</Alert>
					<ul className="flex flex-col gap-2">
						{EFFICIENCY_RESEARCH_ORDER.map((researchId) => (
							<li key={researchId}>
								<ResearchItemCard researchId={researchId} />
							</li>
						))}
					</ul>
				</motion.div>

				{/* Speed research section */}
				<motion.div
					variants={{
						hidden: { opacity: 0, y: 20 },
						visible: { opacity: 1, y: 0 },
					}}
				>
					<h3 className="text-sm font-semibold text-text-secondary mb-3">
						Speed Research
					</h3>
					<Alert className="mb-3">
						<HugeiconsIcon
							icon={InformationCircleIcon}
							size={16}
							aria-hidden="true"
						/>
						<AlertDescription>
							Unlock a resource in the game to research its speed.
						</AlertDescription>
					</Alert>
					<ul className="flex flex-col gap-2">
						{SPEED_RESEARCH_ORDER.map((researchId) => (
							<li key={researchId}>
								<ResearchItemCard researchId={researchId} />
							</li>
						))}
					</ul>
				</motion.div>
			</motion.div>

			{/* Research picker dialog */}
			{pickerLabId !== null && (
				<ResearchPickerDialog
					labId={pickerLabId}
					open={pickerLabId !== null}
					onOpenChange={(open) => {
						if (!open) {
							setPickerLabId(null);
						}
					}}
				/>
			)}
		</div>
	);
};
