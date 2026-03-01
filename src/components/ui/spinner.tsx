import { cn } from "@/lib/utils";

type Props = {
	className?: string;
};

export const Spinner = ({ className }: Props) => (
	<span
		className={cn(
			"size-4 border-2 border-current border-t-transparent rounded-full animate-spin",
			className,
		)}
		aria-hidden="true"
	/>
);
