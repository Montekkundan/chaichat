"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search, Settings2, SunMoon } from "lucide-react";
import type { ReactNode } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import {
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "~/components/ui/sidebar";
import { SidebarInset } from "~/components/ui/sidebar";
import { TooltipContent } from "~/components/ui/tooltip";
import {
	Tooltip,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import Link from "next/link";
import { useTheme } from "next-themes";

export default function ChatLayout({ children }: { children: ReactNode }) {
	return (
		<SidebarProvider>
			<TopLeftControls />
			<TopRightControls />
			<AppSidebar />
			<MainContentWithInset>{children}</MainContentWithInset>
		</SidebarProvider>
	);
}

function MainContentWithInset({ children }: { children: ReactNode }) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	return (
		<main className="relative w-full flex-1 overflow-hidden bg-sidebar">
			{/* Decorative top-right wave overlay */}
			{typeof window !== "undefined" && (
				<div
					className={`fixed right-0 top-0 z-20 h-16 w-28 max-sm:hidden transition-all ease-snappy ${collapsed ? "!translate-y-0 !rounded-none border-none" : "sm:translate-y-3.5 sm:rounded-tl-xl"}`}
					style={{ clipPath: "inset(0px 12px 0px 0px)" }}
				>
					<div
						className="pointer-events-none group absolute top-3.5 z-10 -mb-8 h-32 w-full origin-top transition-all ease-snappy"
						style={{ boxShadow: "10px -10px 8px 2px hsl(var(--gradient-noise-top))" }}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 128 32"
							fill="hsl(var(--gradient-noise-top))"
							className="absolute -right-8 h-9 origin-top-left skew-x-[30deg] overflow-visible"
							aria-hidden="true"
							role="presentation"
						>
							<line
								x1="1"
								y1="0"
								x2="128"
								y2="0"
								stroke="hsl(var(--gradient-noise-top))"
								strokeWidth="2"
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
							<path
								className="translate-y-[0.5px]"
								stroke="hsl(var(--chat-border))"
								strokeWidth="1"
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
								d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0"
							/>
						</svg>
					</div>
				</div>
			)}
			<div
				className={`absolute top-0 bottom-0 w-full overflow-hidden border-chat-border border-t border-l bg-secondary bg-fixed transition-all ease-snappy max-sm:border-none ${!collapsed ? "sm:translate-y-3.5 sm:rounded-tl-2xl" : ""}`}
			>
				<SidebarInset>
					<div className="absolute inset-x-3 top-0 z-10 box-content overflow-hidden border-chat-border bg-gradient-noise-top/80 blur-fallback:bg-gradient-noise-top transition-[transform,border] ease-snappy max-sm:hidden sm:h-3.5">
						<div className="absolute top-0 left-0 blur-fallback:hidden h-full w-8 bg-gradient-to-r from-gradient-noise-top to-transparent" />
						<div className="absolute top-0 right-24 blur-fallback:hidden h-full w-8 bg-gradient-to-l from-gradient-noise-top to-transparent" />
						<div className="absolute top-0 right-0 blur-fallback:hidden h-full w-24 bg-gradient-noise-top" />
					</div>
					<div>{children}</div>
				</SidebarInset>
			</div>
		</main>
	);
}

function TopLeftControls() {
	const { state } = useSidebar();

	const collapsedBg = state === "collapsed" ? "bg-sidebar" : "";

	return (
		<div
			className={`pointer-events-auto fixed top-2 left-2 z-50 flex flex-row gap-0.5 rounded-md p-1 ${collapsedBg}`}
		>
			<TooltipProvider delayDuration={0}>
				<motion.div
					key="collapsed-controls"
					initial={false}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0 }}
					transition={{ type: "spring", stiffness: 300, damping: 30 }}
					className="flex flex-row gap-0.5 p-1"
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<SidebarTrigger className="inline-flex h-7 w-7 items-center justify-center gap-2 rounded-md bg-transparent p-0" />
						</TooltipTrigger>
						<TooltipContent side="top" className="px-2 py-1 text-xs">
							Pan top
							<kbd className="-me-1 ms-2 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] font-medium text-[0.625rem] text-muted-foreground/70">
								⌘T
							</kbd>
						</TooltipContent>
					</Tooltip>

					<AnimatePresence>
						{state === "collapsed" && (
							<>
								<motion.button
									type="button"
									className="inline-flex h-7 w-7 items-center justify-center gap-2 rounded-md font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/40 hover:text-foreground"
									initial={{ x: -20, opacity: 0 }}
									animate={{ x: 0, opacity: 1 }}
									exit={{ x: -20, opacity: 0, transition: { duration: 0 } }}
									transition={{
										delay: 0.03,
										type: "spring",
										stiffness: 300,
										damping: 30,
									}}
								>
									<Search className="h-4 w-4" />
									<span className="sr-only">Search</span>
								</motion.button>
								<motion.a
									href="/"
									className="inline-flex h-7 w-7 items-center justify-center gap-2 rounded-md font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/40 hover:text-foreground"
									data-discover="true"
									initial={{ x: -20, opacity: 0 }}
									animate={{ x: 0, opacity: 1 }}
									exit={{ x: -20, opacity: 0, transition: { duration: 0 } }}
									transition={{
										delay: 0.06,
										type: "spring",
										stiffness: 300,
										damping: 30,
									}}
								>
									<Plus className="h-4 w-4" />
									<span className="sr-only">New Thread</span>
								</motion.a>
							</>
						)}
					</AnimatePresence>
				</motion.div>
			</TooltipProvider>
		</div>
	);
}

function TopRightControls() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<div className="pointer-events-auto fixed top-2 right-2 z-50 flex flex-row items-center gap-0.5 rounded-md p-1 bg-gradient-noise-top text-muted-foreground">
			<Link
				aria-label="Go to settings"
				href="/settings/customization"
				className="size-8 inline-flex items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground rounded-bl-xl"
				data-discover="true"
			>
				<Settings2 className="size-4" />
			</Link>
			<button
				type="button"
				aria-label="Toggle theme"
				className="group relative size-8 inline-flex items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground"
				onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			>
				<SunMoon className="absolute size-4" />
				<span className="sr-only">Toggle theme</span>
			</button>
		</div>
	);
}

export { TopLeftControls };
