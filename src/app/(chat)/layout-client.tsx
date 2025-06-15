"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider, useSidebar } from "~/components/ui/sidebar";
import { TopLeftControls } from "~/components/chat/top-left-controls";

export type MinimalUser = {
  id: string;
  firstName?: string | null;
  fullName?: string | null;
  imageUrl?: string;
};

export default function ChatLayoutClient({ children, initialUser }: { children: ReactNode; initialUser?: MinimalUser }) {
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