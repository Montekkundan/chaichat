"use client";

import { type ReactNode, useEffect } from "react";
import { AppSidebar } from "~/components/app-sidebar/app-sidebar";
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
  defaultSidebarOpen = true,
}: { children: ReactNode; initialUser?: MinimalUser; defaultSidebarOpen?: boolean }) {
	useEffect(() => {
		document.body.classList.add("overflow-hidden");
		return () => {
			document.body.classList.remove("overflow-hidden");
		};
	}, []);

	return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
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
				className={`absolute top-0 bottom-0 w-full overflow-hidden border-chat-border border-t border-t-[0.5px] border-l-[0.5px] bg-fixed pb-[140px] transition-all ease-snappy max-sm:border-none sm:translate-y-3.5 sm:rounded-tl-xl ${collapsed ? " !translate-y-0 !rounded-none border-none" : ""}`}
			>
				<div
					className={`-top-3.5 absolute inset-0 bg-noise bg-fixed transition-transform ease-snappy [background-position:right_bottom] ${collapsed ? "translate-y-3.5" : ""}`}
				/>
			</div>
			{/* Decorative top-right wave overlay */}
			<div
				className={`absolute inset-x-3 top-0 z-10 box-content w-full overflow-hidden border-b border-b-[0.5px] bg-sidebar/80 blur-fallback:bg-sidebar backdrop-blur-md transition-[transform,border] ease-snappy max-sm:hidden sm:h-3.5 ${collapsed ? "-translate-y-[15px] border-transparent" : "border-chat-border"}`}
			>
				<div className="absolute top-0 left-0 blur-fallback:hidden h-full w-8 bg-gradient-to-r from-sidebar to-transparent" />
				<div className="absolute top-0 right-24 blur-fallback:hidden h-full w-8 bg-gradient-to-l from-sidebar to-transparent" />
				<div className="absolute top-0 right-0 blur-fallback:hidden h-full w-24 bg-sidebar" />
			</div>
			{children}
		</main>
	);
}
