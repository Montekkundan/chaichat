"use client";
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/app-sidebar";
import { Search, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  return (
    <SidebarProvider>
      <TopLeftControls />
      <AppSidebar />
      <MainContentWithInset />
    </SidebarProvider>
  );
}

function MainContentWithInset() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <div className="relative flex-1 w-full bg-sidebar">
      <div
        className={`absolute top-0 bottom-0 w-full overflow-hidden border-l border-t border-chat-border bg-secondary bg-fixed transition-all ease-snappy max-sm:border-none ${!collapsed ? 'sm:translate-y-3.5 sm:rounded-tl-2xl' : ''}`}
      >
        <SidebarInset>
          <div className="absolute inset-x-3 top-0 z-10 box-content overflow-hidden  border-chat-border bg-gradient-noise-top/80 backdrop-blur-md transition-[transform,border] ease-snappy blur-fallback:bg-gradient-noise-top max-sm:hidden sm:h-3.5">
            <div className="absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-gradient-noise-top to-transparent blur-fallback:hidden" />
            <div className="absolute right-24 top-0 h-full w-8 bg-gradient-to-l from-gradient-noise-top to-transparent blur-fallback:hidden" />
            <div className="absolute right-0 top-0 h-full w-24 bg-gradient-noise-top blur-fallback:hidden" />
          </div>
          <div className="p-4">
            <h1>Hello</h1>
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
    <div className={`pointer-events-auto fixed left-2 top-2 z-50 flex flex-row gap-0.5 p-1 rounded-md ${collapsedBg}`}>
      <motion.div
        key="collapsed-controls"
        initial={false}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex flex-row gap-0.5 p-1"
        // style={state === "collapsed" ? { backdropFilter: "blur(4px)" } : {}}
      >
        <SidebarTrigger className="inline-flex h-7 w-7 items-center justify-center gap-2 rounded-md p-0 bg-transparent" />
        <AnimatePresence>
          {state === "collapsed" && (
            <>
              <motion.button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0, transition: { duration: 0 } }}
                transition={{ delay: 0.03, type: "spring", stiffness: 300, damping: 30 }}
              >
                <Search className="h-4 w-4" />
                <span className="sr-only">Search</span>
              </motion.button>
              <motion.a
                href="/"
                className="inline-flex h-7 w-7 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                data-discover="true"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0, transition: { duration: 0 } }}
                transition={{ delay: 0.06, type: "spring", stiffness: 300, damping: 30 }}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">New Thread</span>
              </motion.a>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}