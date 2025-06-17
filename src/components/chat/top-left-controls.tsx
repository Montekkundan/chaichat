"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import { SidebarTrigger, useSidebar } from "~/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useCache } from "~/lib/providers/cache-provider";
import { useQuota } from "~/lib/providers/quota-provider";

export function TopLeftControls() {
	const router = useRouter();
	const { state } = useSidebar();
	const cache = useCache();
	const quota = useQuota();
	const remaining =
		quota.plan === "pro"
			? `${quota.stdCredits}/${quota.premiumCredits}`
			: quota.stdCredits.toString();

	const badge = (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="inline-flex items-center rounded-md bg-muted/40 px-2 font-medium text-[10px] text-muted-foreground">
					{remaining}
				</span>
			</TooltipTrigger>
			<TooltipContent side="top" className="px-2 py-1 text-xs">
				{quota.plan === "pro" ? "Std / Premium credits" : "Remaining chats"}
			</TooltipContent>
		</Tooltip>
	);

	const collapsedBg = state === "collapsed" ? "bg-sidebar" : "";
	const [openSearch, setOpenSearch] = React.useState(false);

	const handleSearchSelect = (chatId: string) => {
		setOpenSearch(false);
		router.push(`/chat/${chatId}`);
	};

	const recentChats = cache.chats.slice(0, 20);

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

					{badge}

					<AnimatePresence>
						{state === "collapsed" && (
							<>
								<Tooltip>
									<TooltipTrigger asChild>
										<motion.button
											type="button"
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
											initial={{ x: -20, opacity: 0 }}
											animate={{ x: 0, opacity: 1 }}
											exit={{ x: -20, opacity: 0, transition: { duration: 0 } }}
											transition={{
												delay: 0.03,
												type: "spring",
												stiffness: 300,
												damping: 30,
											}}
											onClick={() => setOpenSearch(true)}
										>
											<Search className="h-4 w-4" />
											<span className="sr-only">Search chats"</span>
										</motion.button>
									</TooltipTrigger>
									<TooltipContent side="top" className="px-2 py-1 text-xs">
										Search
									</TooltipContent>
								</Tooltip>
								<Tooltip>
									<TooltipTrigger asChild>
										<motion.button
											type="button"
											className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
											initial={{ x: -20, opacity: 0 }}
											animate={{ x: 0, opacity: 1 }}
											exit={{ x: -20, opacity: 0, transition: { duration: 0 } }}
											transition={{
												delay: 0.06,
												type: "spring",
												stiffness: 300,
												damping: 30,
											}}
											onClick={() => router.push("/")}
										>
											<Plus className="h-4 w-4" />
											<span className="sr-only">New Thread</span>
										</motion.button>
									</TooltipTrigger>
									<TooltipContent side="top" className="px-2 py-1 text-xs">
										New Chat
									</TooltipContent>
								</Tooltip>
							</>
						)}
					</AnimatePresence>
				</motion.div>
			</TooltipProvider>
			{/* Command dialog */}
			<CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
				<CommandInput placeholder="Search chats..." />
				<CommandList>
					<CommandEmpty>No chats found.</CommandEmpty>
					<CommandGroup heading="Recent">
						{recentChats.map((chat) => (
							<CommandItem
								key={chat._id}
								value={chat._id}
								onSelect={() => handleSearchSelect(chat._id)}
							>
								{chat.name}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</div>
	);
}
