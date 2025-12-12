"use client";

import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Textarea } from "~/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

type PromptInputContextType = {
	isLoading: boolean;
	value: string;
	setValue: (value: string) => void;
	maxHeight: number | string;
	onSubmit?: () => void;
	disabled?: boolean;
};

const PromptInputContext = createContext<PromptInputContextType>({
	isLoading: false,
	value: "",
	setValue: () => {},
	maxHeight: 240,
	onSubmit: undefined,
	disabled: false,
});

function usePromptInput() {
	const context = useContext(PromptInputContext);
	if (!context) {
		throw new Error("usePromptInput must be used within a PromptInput");
	}
	return context;
}

type PromptInputProps = {
	isLoading?: boolean;
	value?: string;
	onValueChange?: (value: string) => void;
	maxHeight?: number | string;
	onSubmit?: () => void;
	children: React.ReactNode;
	className?: string;
	disabled?: boolean;
};

function PromptInput({
	className,
	isLoading = false,
	maxHeight = 240,
	value,
	onValueChange,
	onSubmit,
	children,
	disabled = false,
}: PromptInputProps) {
	const [internalValue, setInternalValue] = useState(value || "");

	const handleChange = (newValue: string) => {
		setInternalValue(newValue);
		onValueChange?.(newValue);
	};

	return (
		<TooltipProvider>
			<PromptInputContext.Provider
				value={{
					isLoading,
					value: value ?? internalValue,
					setValue: onValueChange ?? handleChange,
					maxHeight,
					onSubmit,
					disabled,
				}}
			>
				<div
					className={cn(
						"rounded-t-3xl border border-input p-2 shadow-xs",
						className,
					)}
				>
					{children}
				</div>
			</PromptInputContext.Provider>
		</TooltipProvider>
	);
}

export type PromptInputTextareaProps = {
	disableAutosize?: boolean;
} & React.ComponentProps<typeof Textarea>;

function PromptInputTextarea({
	className,
	onKeyDown,
	disableAutosize = false,
	...props
}: PromptInputTextareaProps) {
	const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (disableAutosize) return;

		if (!textareaRef.current) return;
		textareaRef.current.style.height = "auto";
		textareaRef.current.style.height =
			typeof maxHeight === "number"
				? `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`
				: `min(${textareaRef.current.scrollHeight}px, ${maxHeight})`;
	}, [value, maxHeight, disableAutosize]);

	// Type-to-focus: focus the textarea before the browser dispatches text to any element.
	// We focus on keydown (capture) and do NOT mutate value; this keeps IME/composition smooth.
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (disabled) return;
			if (e.defaultPrevented) return;
			const active = document.activeElement as HTMLElement | null;
			const target = e.target as HTMLElement | null;
			const isEditable = (el: HTMLElement | null) => {
				if (!el) return false;
				const tag = el.tagName;
				return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
			};
			if (isEditable(active) || isEditable(target)) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			const key = e.key;
			// Only printable characters (length 1); let IME use composition events naturally
			if (!key || key.length !== 1) return;
			if (!textareaRef.current) return;
			try {
				textareaRef.current.focus({ preventScroll: true } as unknown as FocusOptions);
			} catch {
				try {
					textareaRef.current.focus();
				} catch {}
			}
			// Do not preventDefault; allow the key to be inserted by the browser
		};

		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [disabled]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			onSubmit?.();
		}
		onKeyDown?.(e);
	};

	return (
		<Textarea
			ref={textareaRef}
			value={value}
			onChange={(e) => setValue(e.target.value)}
			onKeyDown={handleKeyDown}
			className={cn(
				"min-h-[44px] w-full resize-none border-none bg-transparent shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
				className,
			)}
			rows={1}
			disabled={disabled}
			{...props}
		/>
	);
}

type PromptInputActionsProps = React.HTMLAttributes<HTMLDivElement>;

function PromptInputActions({
	children,
	className,
	...props
}: PromptInputActionsProps) {
	return (
		<div className={cn("flex items-center gap-2", className)} {...props}>
			{children}
		</div>
	);
}

type PromptInputActionProps = {
	className?: string;
	tooltip: React.ReactNode;
	children: React.ReactNode;
	side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

function PromptInputAction({
	tooltip,
	children,
	className,
	side = "top",
	...props
}: PromptInputActionProps) {
	const { disabled } = usePromptInput();

	return (
		<Tooltip {...props}>
			<TooltipTrigger asChild disabled={disabled}>
				{children}
			</TooltipTrigger>
			<TooltipContent side={side} className={className}>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}

export {
	PromptInput,
	PromptInputTextarea,
	PromptInputActions,
	PromptInputAction,
};
