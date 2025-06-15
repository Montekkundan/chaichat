"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { TopLeftControls } from "~/components/chat/top-left-controls";
import { SidebarProvider, useSidebar } from "~/components/ui/sidebar";

export type MinimalUser = {
	id: string;
	firstName?: string | null;
	fullName?: string | null;
	imageUrl?: string;
};

export default function ChatLayoutClient({
	children,
	initialUser,
}: { children: ReactNode; initialUser?: MinimalUser }) {
	return (
		<SidebarProvider>
			<TopLeftControls />
			<AppSidebar initialUser={initialUser} />
			<MainContentWithInset>{children}</MainContentWithInset>
		</SidebarProvider>
	);
}

function MainContentWithInset({ children }: { children: ReactNode }) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	return (
		<main className="firefox-scrollbar-margin-fix relative flex min-h-pwa w-full flex-1 flex-col overflow-hidden transition-[width,height]">
			<div
				className={`absolute top-0 bottom-0 w-full overflow-hidden border-chat-border border-t border-t-[0.5px] border-l-[0.5px] bg-chat-background bg-fixed pb-[140px] transition-all ease-snappy max-sm:border-none sm:translate-y-3.5 sm:rounded-tl-xl ${collapsed ? " !translate-y-0 !rounded-none border-none" : ""}`}
			>
				<div
					className={`-top-3.5 absolute inset-0 bg-noise bg-fixed transition-transform ease-snappy [background-position:right_bottom] ${collapsed ? "translate-y-3.5" : ""}`}
				/>
			</div>
			{/* Decorative top-right wave overlay */}
			<div
				className={`absolute inset-x-3 top-0 z-10 box-content overflow-hidden border-b border-b-[0.5px] bg-gradient-noise-top/80 blur-fallback:bg-gradient-noise-top backdrop-blur-md transition-[transform,border] ease-snappy max-sm:hidden sm:h-3.5 ${collapsed ? "-translate-y-[15px] border-transparent" : "border-chat-border"}`}
			>
				<div className="absolute top-0 left-0 blur-fallback:hidden h-full w-8 bg-gradient-to-r from-gradient-noise-top to-transparent" />
				<div className="absolute top-0 right-24 blur-fallback:hidden h-full w-8 bg-gradient-to-l from-gradient-noise-top to-transparent" />
				<div className="absolute top-0 right-0 blur-fallback:hidden h-full w-24 bg-gradient-noise-top" />
			</div>
			{children}
		</main>
	);
}
