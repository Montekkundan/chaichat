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
			{/* <TopRightControls /> */}
			<AppSidebar />
			<MainContentWithInset>{children}</MainContentWithInset>
		</SidebarProvider>
	);
}

function MainContentWithInset({ children }: { children: ReactNode }) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	return (
		<main className="firefox-scrollbar-margin-fix relative flex min-h-pwa w-full flex-1 flex-col overflow-hidden transition-[width,height]">
			<div className={`absolute top-0 bottom-0 w-full overflow-hidden border-chat-border border-t border-l-[0.5px] border-t-[0.5px] bg-chat-background bg-fixed pb-[140px] transition-all ease-snappy max-sm:border-none sm:translate-y-3.5 sm:rounded-tl-xl ${collapsed ? ' !translate-y-0 !rounded-none border-none' : ''}`}>
				<div className={`-top-3.5 absolute inset-0 bg-noise bg-fixed transition-transform ease-snappy [background-position:right_bottom] ${collapsed ? 'translate-y-3.5' : ''}`} />
			</div>
			{/* Decorative top-right wave overlay */}
			<div className={`absolute inset-x-3 top-0 z-10 box-content overflow-hidden border-b border-b-[0.5px] bg-gradient-noise-top/80 backdrop-blur-md transition-[transform,border] ease-snappy blur-fallback:bg-gradient-noise-top max-sm:hidden sm:h-3.5 ${collapsed ? '-translate-y-[15px] border-transparent' : 'border-chat-border'}`}>
				<div className="absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-gradient-noise-top to-transparent blur-fallback:hidden" />
				<div className="absolute right-24 top-0 h-full w-8 bg-gradient-to-l from-gradient-noise-top to-transparent blur-fallback:hidden" />
				<div className="absolute right-0 top-0 h-full w-24 bg-gradient-noise-top blur-fallback:hidden" />
			</div>
			{children}
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

// function TopRightControls() {
// 	const { resolvedTheme, setTheme } = useTheme();

// 	return (
// 		<div className="pointer-events-auto fixed top-2 right-2 z-50 flex flex-row items-center gap-0.5 rounded-md p-1 bg-gradient-noise-top text-muted-foreground">
// 			<Link
// 				aria-label="Go to settings"
// 				href="/settings/customization"
// 				className="size-8 inline-flex items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground rounded-bl-xl"
// 				data-discover="true"
// 			>
// 				<Settings2 className="size-4" />
// 			</Link>
// 			<button
// 				type="button"
// 				aria-label="Toggle theme"
// 				className="group relative size-8 inline-flex items-center justify-center rounded-md hover:bg-muted/40 hover:text-foreground"
// 				onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
// 			>
// 				<SunMoon className="absolute size-4" />
// 				<span className="sr-only">Toggle theme</span>
// 			</button>
// 		</div>
// 	);
// }

// export { TopLeftControls };
