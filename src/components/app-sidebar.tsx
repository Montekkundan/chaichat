"use client";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { Unauthenticated } from "convex/react";
import { GitBranch, Search, X, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "~/components/ui/toast";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { useCache } from "~/lib/providers/cache-provider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ShareChatModal } from "~/components/modals/share-chat-modal";
import type { Id } from "@/convex/_generated/dataModel";

import { DeleteChatModal } from "~/components/modals/delete-chat-modal";

export function AppSidebar({
	initialUser,
}: {
	initialUser?: {
		id: string;
		fullName?: string | null;
		firstName?: string | null;
		imageUrl?: string;
	};
} = {}) {
	const { user } = useUser();
	const router = useRouter();
	const cache = useCache();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [chatToDelete, setChatToDelete] = useState<string | null>(null);
	const toggleVisibility = useMutation(api.chat.toggleChatVisibility);
	const [shareChatId, setShareChatId] = useState<string | null>(null);

	const effectiveUser = user ?? initialUser;

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearch(search);
		}, 200);
		return () => clearTimeout(handler);
	}, [search]);

	// Filter chats based on search - now using cached data
	const displayedChats = useMemo(() => {
		if (!debouncedSearch.trim()) {
			return cache.chats;
		}

		return cache.chats.filter((chat) =>
			chat.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
		);
	}, [cache.chats, debouncedSearch]);

	const handleProfileClick = (_e: React.MouseEvent | React.KeyboardEvent) => {
		router.push("/settings/subscription");
	};

	const handleNewChat = async () => {
		if (!effectiveUser) {
			router.push("/login");
			return;
		}
		router.push("/");
	};

	const handleDeleteClick = (chatId: string) => {
		setChatToDelete(chatId);
		setDeleteModalOpen(true);
	};

	const setChatPublicState = async (chatId: string, newValue: boolean | undefined) => {
		if (newValue === undefined) return;
		try {
			await toggleVisibility({ chatId: chatId as Id<"chats">, isPublic: newValue, userId: effectiveUser?.id ?? "" });
			cache.refreshCache();
			if (newValue) {
				const url = `${window.location.origin}/p/${chatId}`;
				await navigator.clipboard.writeText(url);
				toast({ title: "Public link copied to clipboard", status: "success" });
			}
		} catch (e) {
			console.error(e);
			toast({ title: "Failed to update visibility", status: "error" });
		}
	};

	const handleConfirmDelete = async () => {
		if (chatToDelete) {
			setDeleteModalOpen(false);
			const chatIdToDelete = chatToDelete;
			setChatToDelete(null);

			try {
				await cache.deleteChat(chatIdToDelete);
				router.push("/");
			} catch (error) {
				console.error("Failed to delete chat:", error);
			}
		}
	};

	const handleCancelDelete = () => {
		setDeleteModalOpen(false);
		setChatToDelete(null);
	};

	return (
		<Sidebar>
			<SidebarHeader>
				<div className="ml-8 flex items-center justify-center gap-1 py-1 pt-2 text-center tracking-tight">
					<span className="text-xl">ChaiChat</span>
					<Badge className="text-[8px]">ALPHA</Badge>
				</div>
				<Button className="cursor-pointer" onClick={handleNewChat}>
					New Chat
				</Button>
				<div className="mb-4">
					<div className="relative">
						<input
							type="text"
							placeholder="Search your threads..."
							className="w-full rounded-md border border-muted bg-background px-3 py-2 pl-10 text-sm focus:outline-none"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<div className="px-2">
					{effectiveUser ? (
						<>
							<div className="mb-2 font-semibold text-muted-foreground text-xs">
								Your Chats
							</div>
							<SidebarMenu>
								{cache.isLoading ? (
									<div className="px-4 py-2 text-muted-foreground text-xs">
										Loading...
									</div>
								) : cache.isSyncing ? (
									<div className="px-4 py-2 text-muted-foreground text-xs">
										Syncing...
									</div>
								) : (
									displayedChats?.map((chat) => (
										<SidebarMenuItem
											key={chat._id}
											className="group/chat relative"
										>
											<SidebarMenuButton
												asChild
												className="flex w-full items-center gap-1 pr-12"
											>
												<Link
													href={`/chat/${chat._id}`}
													className="flex items-center gap-1"
												>
													{chat.parentChatId && (
														<GitBranch className="h-3 w-3 text-muted-foreground" />
													)}
													<span>{chat.name}</span>
													{chat.isPublic && (
														<Badge className="ml-1" variant="outline" >Public</Badge>
													)}
												</Link>
											</SidebarMenuButton>

											{/* Delete button shows on row hover */}
											<button
												type="button"
												className="-translate-y-1/2 absolute top-1/2 right-2 hidden items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus:outline-none group-hover/chat:inline-flex"
												onClick={(e) => {
													e.preventDefault();
													handleDeleteClick(chat._id);
												}}
												aria-label="Delete chat"
											>
												<X className="size-4" />
											</button>
											<button
												type="button"
												className="-translate-y-1/2 absolute top-1/2 right-8 hidden items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-muted/20 hover:text-foreground focus:outline-none group-hover/chat:inline-flex"
												onClick={(e)=>{e.preventDefault();setShareChatId(chat._id);}}
												aria-label="Share chat"
											>
												<Share2 className="size-4" />
											</button>
										</SidebarMenuItem>
									))
								)}
							</SidebarMenu>
						</>
					) : (
						<div className="py-6 text-center text-muted-foreground text-xs">
							Sign in to start chatting.
						</div>
					)}
				</div>
			</SidebarContent>
			<SidebarFooter>
				{effectiveUser ? (
					<button
						type="button"
						className="flex w-full cursor-pointer items-center gap-3 px-4 py-4"
						onClick={handleProfileClick}
						onKeyDown={(e) =>
							(e.key === "Enter" || e.key === " ") && handleProfileClick(e)
						}
						tabIndex={0}
					>
						<img
							src={effectiveUser.imageUrl ?? ""}
							alt={effectiveUser.fullName || "User"}
							className="h-10 w-10 rounded-full"
						/>
						<div className="flex flex-col items-start">
							<span className="font-semibold">
								{effectiveUser.fullName ?? effectiveUser.firstName}
							</span>
							<span className="text-muted-foreground text-xs">Free</span>
						</div>
					</button>
				) : (
					<div className="flex items-center justify-center py-4">
						<Unauthenticated>
							<SignInButton />
						</Unauthenticated>
					</div>
				)}
			</SidebarFooter>

			<DeleteChatModal
				open={deleteModalOpen}
				onOpenChange={setDeleteModalOpen}
				onCancel={handleCancelDelete}
				onConfirm={handleConfirmDelete}
			/>
			{shareChatId && (
				<ShareChatModal
					open={shareChatId !== null}
					onOpenChange={(open) => {
						if (!open) setShareChatId(null);
				 }}
					chatId={shareChatId}
					isPublic={cache.chats.find((c) => c._id === shareChatId)?.isPublic}
					onToggle={(newVal) => setChatPublicState(shareChatId, newVal)}
				/>
			)}
		</Sidebar>
	);
}
