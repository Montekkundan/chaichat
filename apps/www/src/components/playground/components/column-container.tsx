"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface ColumnContainerProps {
	children: ReactNode;
	isDragOver?: boolean;
	onDragEnter?: React.DragEventHandler<HTMLDivElement>;
	onDragLeave?: React.DragEventHandler<HTMLDivElement>;
	onDragOver?: React.DragEventHandler<HTMLDivElement>;
	onDrop?: React.DragEventHandler<HTMLDivElement>;
	dragOverlay?: ReactNode;
	className?: string;
}

export function ColumnContainer({
	children,
	isDragOver,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
	dragOverlay,
	className,
}: ColumnContainerProps) {
	return (
		<div
			className={cn(
				"relative flex h-full min-h-0 flex-col rounded-xl border",
				className,
				isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
			)}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
			onDragOver={onDragOver}
			onDrop={onDrop}
		>
			{isDragOver && dragOverlay}
			<div className="h-full min-h-0 w-full rounded-b-md">{children}</div>
		</div>
	);
}
