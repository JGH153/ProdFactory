"use client";

import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { motion } from "motion/react";
import { useState } from "react";
import { LabCard } from "@/components/lab-card";
import { ResearchItemCard } from "@/components/research-item-card";
import { ResearchPickerDialog } from "@/components/research-picker-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LAB_ORDER, RESEARCH_ORDER } from "@/game/research-config";
import type { LabId } from "@/game/types";

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

				{/* Research items section */}
				<motion.div
					variants={{
						hidden: { opacity: 0, y: 20 },
						visible: { opacity: 1, y: 0 },
					}}
				>
					<h3 className="text-sm font-semibold text-text-secondary mb-3">
						Available Research
					</h3>
					<Alert className="mb-3">
						<HugeiconsIcon icon={InformationCircleIcon} size={16} />
						<AlertDescription>
							Unlock a resource in the game to research its efficiency.
						</AlertDescription>
					</Alert>
					<div className="flex flex-col gap-2">
						{RESEARCH_ORDER.map((researchId) => (
							<ResearchItemCard key={researchId} researchId={researchId} />
						))}
					</div>
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
