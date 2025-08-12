"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { ChevronRight, History, Share2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShareChatModal } from "~/components/modals/share-chat-modal";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "~/components/ui/sidebar";
import { toast } from "~/components/ui/toast";
import { ChatTitlesCookieManager } from "~/lib/chat-titles-cookie";
import { type LocalChat, localChatStorage } from "~/lib/local-chat-storage";
import { useCache } from "~/lib/providers/cache-provider";
import { userSessionManager } from "~/lib/user-session-manager";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../ui/collapsible";
import { HistoryDialog } from "./history-dialog";

export function HistorySection() {
	const { user } = useUser();
	const cache = useCache();
	const router = useRouter();
	const { state } = useSidebar();
	const [recentChats, setRecentChats] = useState<LocalChat[]>([]);
	const [chatCount, setChatCount] = useState(0);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [chatToDelete, setChatToDelete] = useState<string | null>(null);
	const [shareChatId, setShareChatId] = useState<string | null>(null);
	const toggleVisibility = useMutation(api.chat.toggleChatVisibility);

	useEffect(() => {
		const loadRecentChats = async () => {
			if (!user) {
				const storageUserId = userSessionManager.getStorageUserId();
				const chats = await localChatStorage.getRecentChats(3, storageUserId);
				const count = await localChatStorage.getChatCount(storageUserId);
				setRecentChats(chats);
				setChatCount(count);

				// Sync chat titles to cookies for server-side access
				for (const chat of chats) {
					ChatTitlesCookieManager.setChatTitle(chat.id, chat.name);
				}
			} else {
				const [cacheChats, localChats] = await Promise.all([
					Promise.resolve(cache.chats.slice(0, 3)),
					localChatStorage.getRecentChats(3, user.id),
				]);

				const chatMap = new Map();

				for (const chat of localChats) {
					chatMap.set(chat._id, chat);
				}

				for (const chat of cacheChats) {
					chatMap.set(chat._id, {
						...chat,
						id: chat._id,
					});
				}

				const mergedChats = Array.from(chatMap.values()).sort(
					(a, b) => b.createdAt - a.createdAt,
				);
				setRecentChats(mergedChats.slice(0, 3));
				setChatCount(cache.chats.length);

				// Sync chat titles to cookies for server-side access
				for (const chat of mergedChats) {
					ChatTitlesCookieManager.setChatTitle(chat.id || chat._id, chat.name);
				}
			}
		};

		loadRecentChats();

		const interval = setInterval(loadRecentChats, 500);
		return () => clearInterval(interval);
	}, [user, cache.chats]);

	const handleDeleteClick = (chatId: string) => {
		setChatToDelete(chatId);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!chatToDelete) return;

		try {
			if (!user) {
				await localChatStorage.deleteChat(chatToDelete);
				const storageUserId = userSessionManager.getStorageUserId();
				const chats = await localChatStorage.getRecentChats(3, storageUserId);
				const count = await localChatStorage.getChatCount(storageUserId);
				setRecentChats(chats);
				setChatCount(count);
			} else {
				await Promise.all([
					cache.deleteChat(chatToDelete),
					localChatStorage.deleteChat(chatToDelete),
				]);
			}

			router.push("/");
		} catch (error) {
			console.error("Failed to delete chat:", error);
		} finally {
			setDeleteDialogOpen(false);
			setChatToDelete(null);
		}
	};

	const handleCancelDelete = () => {
		setDeleteDialogOpen(false);
		setChatToDelete(null);
	};

	const handleChatClick = (chatId: string, chatName: string) => {
		// Ensure the chat title is always synced to cookies when clicked
		ChatTitlesCookieManager.setChatTitle(chatId, chatName);
	};

	const setChatPublicState = async (
		chatId: string,
		newValue: boolean | undefined,
	) => {
		if (newValue === undefined) return;
		try {
			await toggleVisibility({
				chatId: chatId as Id<"chats">,
				isPublic: newValue,
				userId: user?.id ?? "",
			});
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

	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel>History ({chatCount})</SidebarGroupLabel>
				<SidebarMenu>
					<Collapsible
						key="History"
						asChild
						defaultOpen={true}
						className="group/collapsible"
					>
						<SidebarMenuItem>
							<CollapsibleTrigger asChild>
								<SidebarMenuButton
									tooltip="History"
									onClick={(e) => {
										if (state === "collapsed") {
											e.preventDefault();
											e.stopPropagation();
											setIsDialogOpen(true);
										}
									}}
								>
									<History className="h-4 w-4" />
									<span>History</span>
									<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
								</SidebarMenuButton>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									{recentChats.map((subItem) => (
										<SidebarMenuSubItem key={subItem.id} className="group/chat">
											<SidebarMenuSubButton asChild>
												<Link
													href={`/chat/${subItem.id}`}
													onClick={() =>
														handleChatClick(subItem.id, subItem.name)
													}
												>
													<span>{subItem.name}</span>
												</Link>
											</SidebarMenuSubButton>
											<div className="-translate-y-1/2 absolute top-1/2 right-2 hidden items-center gap-1 group-hover/chat:flex">
												{user && (
													<button
														type="button"
														className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
														onClick={(e) => {
															e.preventDefault();
															if (!user) return;
															setShareChatId(subItem.id);
														}}
														aria-label="Share chat"
													>
														<Share2 className="h-3 w-3" />
													</button>
												)}
												<button
													type="button"
													className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
													onClick={(e) => {
														e.preventDefault();
														handleDeleteClick(subItem.id);
													}}
													aria-label="Delete chat"
												>
													<X className="h-3 w-3" />
												</button>
											</div>
										</SidebarMenuSubItem>
									))}
									{chatCount > 0 && (
										<SidebarMenuItem>
											<SidebarMenuButton
												onClick={() => setIsDialogOpen(true)}
												className="text-muted-foreground hover:text-foreground"
											>
												<History className="h-4 w-4" />
												<span>See all ({chatCount})</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									)}
								</SidebarMenuSub>
							</CollapsibleContent>
						</SidebarMenuItem>
					</Collapsible>
				</SidebarMenu>
			</SidebarGroup>

			<HistoryDialog
				open={isDialogOpen}
				onOpenChange={setIsDialogOpen}
				isLoggedIn={!!user}
			/>

			{user && shareChatId && (
				<ShareChatModal
					open={shareChatId !== null}
					onOpenChange={(open) => {
						if (!open) setShareChatId(null);
					}}
					chatId={shareChatId}
					isPublic={
						recentChats.find((c) => c.id === shareChatId)?.isPublic ??
						cache.chats.find((c) => c._id === shareChatId)?.isPublic
					}
					onToggle={(newVal) => setChatPublicState(shareChatId, newVal)}
				/>
			)}

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Chat</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this chat? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={handleCancelDelete}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleConfirmDelete}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
