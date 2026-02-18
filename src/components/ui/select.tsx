"use client";

import { Select as RadixSelect } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Select = RadixSelect.Root;

const SelectValue = RadixSelect.Value;

const SelectTrigger = ({
	className,
	children,
	...props
}: React.ComponentProps<typeof RadixSelect.Trigger>) => (
	<RadixSelect.Trigger
		className={cn(
			"flex h-9 w-full items-center justify-between rounded-md border border-border bg-secondary px-3 py-2 text-sm text-text-primary shadow-xs outline-none focus:ring-2 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
			className,
		)}
		{...props}
	>
		{children}
		<RadixSelect.Icon asChild>
			<ChevronDownIcon />
		</RadixSelect.Icon>
	</RadixSelect.Trigger>
);

const SelectContent = ({
	className,
	children,
	position = "popper",
	...props
}: React.ComponentProps<typeof RadixSelect.Content>) => (
	<RadixSelect.Portal>
		<RadixSelect.Content
			className={cn(
				"relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border border-border bg-card text-text-primary shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				position === "popper" &&
					"data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
				className,
			)}
			position={position}
			{...props}
		>
			<RadixSelect.Viewport
				className={cn(
					"p-1",
					position === "popper" &&
						"h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)",
				)}
			>
				{children}
			</RadixSelect.Viewport>
		</RadixSelect.Content>
	</RadixSelect.Portal>
);

const SelectItem = ({
	className,
	children,
	...props
}: React.ComponentProps<typeof RadixSelect.Item>) => (
	<RadixSelect.Item
		className={cn(
			"relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
			className,
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<RadixSelect.ItemIndicator>
				<CheckIcon />
			</RadixSelect.ItemIndicator>
		</span>
		<RadixSelect.ItemText>{children}</RadixSelect.ItemText>
	</RadixSelect.Item>
);

const ChevronDownIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		className="opacity-50"
		aria-hidden="true"
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
);

const CheckIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M20 6 9 17l-5-5" />
	</svg>
);

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
