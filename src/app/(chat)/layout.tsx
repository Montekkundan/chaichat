"use client";
import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarInset } from "~/components/ui/sidebar";
import { TooltipContent } from "~/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipProvider } from "~/components/ui/tooltip";
import { Search, Plus } from "lucide-react";

export default function ChatLayout({ children }: { children: ReactNode }) {
	return (
		<SidebarProvider>
			<TopLeftControls />
			<AppSidebar />
			<MainContentWithInset>{children}</MainContentWithInset>
		</SidebarProvider>
	);
}

function MainContentWithInset({ children }: { children: ReactNode }) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	return (
		<div className="relative w-full flex-1 overflow-hidden bg-sidebar">
			<div
				className={`absolute top-0 bottom-0 w-full overflow-hidden border-chat-border border-t border-l bg-secondary bg-fixed transition-all ease-snappy max-sm:border-none ${!collapsed ? "sm:translate-y-3.5 sm:rounded-tl-2xl" : ""}`}
			>
				<SidebarInset>
					<div className="absolute inset-x-3 top-0 z-10 box-content overflow-hidden border-chat-border bg-gradient-noise-top/80 blur-fallback:bg-gradient-noise-top backdrop-blur-md transition-[transform,border] ease-snappy max-sm:hidden sm:h-3.5">
						<div className="absolute top-0 left-0 blur-fallback:hidden h-full w-8 bg-gradient-to-r from-gradient-noise-top to-transparent" />
						<div className="absolute top-0 right-24 blur-fallback:hidden h-full w-8 bg-gradient-to-l from-gradient-noise-top to-transparent" />
						<div className="absolute top-0 right-0 blur-fallback:hidden h-full w-24 bg-gradient-noise-top" />
					</div>
					<div className="flex min-h-[60vh] flex-col p-4">
						{children}
					</div>
				</SidebarInset>
			</div>
		</div>
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

export { TopLeftControls };