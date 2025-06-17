"use client";

import { X } from "@phosphor-icons/react";
import {
	AnimatePresence,
	MotionConfig,
	type Transition,
	type Variant,
	motion,
} from "motion/react";
import React, {
	useCallback,
	useContext,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "~/lib/utils";
import useClickOutside from "./useClickOutside";

export type MorphingDialogContextType = {
	isOpen: boolean;
	setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	uniqueId: string;
	triggerRef: React.RefObject<HTMLDivElement>;
	images?: GalleryImage[];
	current: number;
	setCurrent: React.Dispatch<React.SetStateAction<number>>;
	next: () => void;
	prev: () => void;
};

const MorphingDialogContext =
	React.createContext<MorphingDialogContextType | null>(null);

function useMorphingDialog() {
	const context = useContext(MorphingDialogContext);
	if (!context) {
		throw new Error(
			"useMorphingDialog must be used within a MorphingDialogProvider",
		);
	}
	return context;
}

export type GalleryImage = { url: string; alt?: string };

export type MorphingDialogProviderProps = {
	children: React.ReactNode;
	transition?: Transition;
	images?: GalleryImage[];
	initialIndex?: number;
};

function MorphingDialogProvider({
	children,
	transition,
	images,
	initialIndex = 0,
}: MorphingDialogProviderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const uniqueId = useId();
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const triggerRef = useRef<HTMLDivElement>(null!);

	const [current, setCurrent] = useState(initialIndex);

	// helpers to move in gallery
	const next = useCallback(() => {
		if (!images || images.length === 0) return;
		setCurrent((prev) => (prev + 1) % images.length);
	}, [images]);

	const prev = useCallback(() => {
		if (!images || images.length === 0) return;
		setCurrent((prev) => (prev - 1 + images.length) % images.length);
	}, [images]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
		const contextValue = useMemo(
		() => ({
			isOpen,
			setIsOpen,
			uniqueId,
			triggerRef,
			images,
			current,
			setCurrent,
			next,
			prev,
		}),
		[isOpen, uniqueId, images, current, setCurrent, next, prev],
	);

	return (
		<MorphingDialogContext.Provider value={contextValue}>
			<MotionConfig transition={transition}>{children}</MotionConfig>
		</MorphingDialogContext.Provider>
	);
}

export type MorphingDialogProps = {
	children: React.ReactNode;
	transition?: Transition;
	images?: GalleryImage[];
	initialIndex?: number;
};

export function MorphingDialog({ children, transition, images, initialIndex }: MorphingDialogProps) {
	return (
		<MorphingDialogProvider transition={transition} images={images} initialIndex={initialIndex}>
			<MotionConfig transition={transition}>{children}</MotionConfig>
		</MorphingDialogProvider>
	);
}

export type MorphingDialogTriggerProps = {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	triggerRef?: React.RefObject<HTMLButtonElement>;
	imageIndex?: number; // for gallery initial index
};

export function MorphingDialogTrigger({
	children,
	className,
	style,
	triggerRef,
	imageIndex,
}: MorphingDialogTriggerProps) {
	const { setIsOpen, isOpen, uniqueId, setCurrent } = useMorphingDialog();

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const handleClick = useCallback(() => {
		if (typeof imageIndex === "number") {
			setCurrent(imageIndex);
		}
		setIsOpen(!isOpen);
	}, [isOpen, setIsOpen, imageIndex, setCurrent]);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				setIsOpen(!isOpen);
			}
		},
		[isOpen, setIsOpen],
	);

	return (
		<motion.button
			ref={triggerRef}
			layoutId={`dialog-${uniqueId}`}
			className={cn("relative", className)}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			style={style}
			aria-haspopup="dialog"
			aria-expanded={isOpen}
			aria-controls={`motion-ui-morphing-dialog-content-${uniqueId}`}
			aria-label={`Open dialog ${uniqueId}`}
		>
			{children}
		</motion.button>
	);
}

export type MorphingDialogContentProps = {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
};

export function MorphingDialogContent({
	children,
	className,
	style,
}: MorphingDialogContentProps) {
	const { setIsOpen, isOpen, uniqueId, triggerRef, images, current, next, prev } = useMorphingDialog();
	// biome-ignore lint/style/noNonNullAssertion: <explanation>
	const containerRef = useRef<HTMLDivElement>(null!);
	const [firstFocusableElement, setFirstFocusableElement] =
		useState<HTMLElement | null>(null);
	const [lastFocusableElement, setLastFocusableElement] =
		useState<HTMLElement | null>(null);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(false);
			}
			if (event.key === "Tab") {
				if (!firstFocusableElement || !lastFocusableElement) return;

				if (event.shiftKey) {
					if (document.activeElement === firstFocusableElement) {
						event.preventDefault();
						lastFocusableElement.focus();
					}
				} else {
					if (document.activeElement === lastFocusableElement) {
						event.preventDefault();
						firstFocusableElement.focus();
					}
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);

		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [setIsOpen, firstFocusableElement, lastFocusableElement]);

	useEffect(() => {
		if (isOpen) {
			document.body.classList.add("overflow-hidden");
			const focusableElements = containerRef.current?.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			if (focusableElements && focusableElements.length > 0) {
				setFirstFocusableElement(focusableElements[0] as HTMLElement);
				setLastFocusableElement(
					focusableElements[focusableElements.length - 1] as HTMLElement,
				);
				(focusableElements[0] as HTMLElement).focus();
			}
		} else {
			document.body.classList.remove("overflow-hidden");
			triggerRef.current?.focus();
		}
	}, [isOpen, triggerRef]);

	useClickOutside(containerRef, () => {
		if (isOpen) {
			setIsOpen(false);
		}
	});

	return (
		<motion.div
			ref={containerRef}
			layoutId={`dialog-${uniqueId}`}
			className={cn("overflow-hidden", className, "relative")}
			style={style}
			// biome-ignore lint/a11y/useSemanticElements: <explanation>
			role="dialog"
			aria-modal="true"
			aria-labelledby={`motion-ui-morphing-dialog-title-${uniqueId}`}
			aria-describedby={`motion-ui-morphing-dialog-description-${uniqueId}`}
		>
			{children}
			{images && images.length > 1 && (
				<>
					<button
						type="button"
						aria-label="Previous image"
						onClick={(e)=>{e.stopPropagation(); prev();}}
						className="absolute left-4 top-1/2 -translate-y-1/2 -mt-4 size-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-2xl z-[60] hover:bg-background"
					>
						‹
					</button>
					<button
						type="button"
						aria-label="Next image"
						onClick={(e)=>{e.stopPropagation(); next();}}
						className="absolute right-4 top-1/2 -translate-y-1/2 -mt-4 size-10 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-2xl z-[60] hover:bg-background"
					>
						›
					</button>
				</>
			)}
		</motion.div>
	);
}

export function MorphingDialogContainer({ children }: { children: React.ReactNode }) {
	const { isOpen, uniqueId, images, next, prev } = useMorphingDialog();
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
		return () => setMounted(false);
	}, []);
	if (!mounted) return null;
	return createPortal(
		<AnimatePresence initial={false} mode="sync">
			{isOpen && (
				<>
					<motion.div
						key={`backdrop-${uniqueId}`}
						className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					/>
					<div className="fixed inset-0 z-50 flex items-center justify-center">
						{children}
					</div>
				</>
			)}
		</AnimatePresence>,
		document.body,
	);
}

export function MorphingDialogImage({ src, alt = "", className }: { src?: string; alt?: string; className?: string }) {
	const { images, current } = useMorphingDialog();
	const active = images && images.length > 0 ? images[current] : undefined;
	const finalSrc = active ? active.url : src ?? "";
	const finalAlt = active ? active.alt ?? "" : alt ?? "";
	return <img src={finalSrc} alt={finalAlt} className={className} />;
}

export function MorphingDialogClose({ className }: { className?: string }) {
	const { setIsOpen } = useMorphingDialog();
	return (
		<button
			type="button"
			aria-label="Close"
			className={cn("absolute top-4 right-4 z-50", className)}
			onClick={() => setIsOpen(false)}
		>
			<X size={20} />
		</button>
	);
}

export const MorphingDialogTitle = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const MorphingDialogSubtitle = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
export const MorphingDialogDescription = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;