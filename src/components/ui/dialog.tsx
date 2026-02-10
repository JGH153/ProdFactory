"use client";

import { Dialog as RadixDialog } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Dialog = RadixDialog.Root;

const DialogTrigger = RadixDialog.Trigger;

const DialogPortal = RadixDialog.Portal;

const DialogClose = RadixDialog.Close;

const DialogOverlay = ({
	className,
	...props
}: React.ComponentProps<typeof RadixDialog.Overlay>) => (
	<RadixDialog.Overlay
		className={cn(
			"fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className,
		)}
		{...props}
	/>
);

const DialogContent = ({
	className,
	children,
	...props
}: React.ComponentProps<typeof RadixDialog.Content>) => (
	<DialogPortal>
		<DialogOverlay />
		<RadixDialog.Content
			className={cn(
				"fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
				className,
			)}
			{...props}
		>
			{children}
		</RadixDialog.Content>
	</DialogPortal>
);

const DialogTitle = ({
	className,
	...props
}: React.ComponentProps<typeof RadixDialog.Title>) => (
	<RadixDialog.Title
		className={cn("text-lg font-semibold text-text-primary", className)}
		{...props}
	/>
);

const DialogDescription = ({
	className,
	...props
}: React.ComponentProps<typeof RadixDialog.Description>) => (
	<RadixDialog.Description
		className={cn("text-sm text-text-muted", className)}
		{...props}
	/>
);

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
};
