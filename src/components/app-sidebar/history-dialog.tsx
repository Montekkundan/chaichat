"use client";

import { useUser } from "@clerk/nextjs";
import { GitBranch, History, MessageSquare, Search, Trash } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Conversation } from "~/components/chat/conversation";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
} from "~/components/ui/sidebar";
import { ChatTitlesCookieManager } from "~/lib/chat-titles-cookie";
import {
	type LocalChat,
	type LocalMessage,
	localChatStorage,
} from "~/lib/local-chat-storage";
import { useCache } from "~/lib/providers/cache-provider";

// removed: legacy text extraction helper; rendering now handled by Conversation component

export function HistoryDialog({
	open,
	onOpenChange,
	isLoggedIn,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	isLoggedIn: boolean;
}) {
	const { user } = useUser();
	const cache = useCache();
	const [chats, setChats] = React.useState<LocalChat[]>([]);
	const [selectedChat, setSelectedChat] = React.useState<LocalChat | null>(
		null,
	);
	const [messages, setMessages] = React.useState<LocalMessage[]>([]);
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
	const [chatToDelete, setChatToDelete] = React.useState<string | null>(null);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [filteredChats, setFilteredChats] = React.useState<LocalChat[]>([]);
	const [chatMessages, setChatMessages] = React.useState<
		Map<string, LocalMessage[]>
	>(new Map());

	React.useEffect(() => {
		const loadChats = async () => {
			if (!isLoggedIn) {
				const localChats = await localChatStorage.getChats();
				setChats(localChats);

				// Sync all chat titles to cookies
				for (const chat of localChats) {
					ChatTitlesCookieManager.setChatTitle(chat.id, chat.name);
				}
			} else {
				const [cacheChats, localChats] = await Promise.all([
					Promise.resolve(
						cache.chats.map((chat) => ({
							...chat,
							id: chat._id,
						})),
					),
					localChatStorage.getChats(user?.id),
				]);

				const chatMap = new Map();

				for (const chat of localChats) {
					chatMap.set(chat._id, chat);
				}

				for (const chat of cacheChats) {
					chatMap.set(chat._id, chat);
				}

				const mergedChats = Array.from(chatMap.values()).sort(
					(a, b) => b.createdAt - a.createdAt,
				);
				setChats(mergedChats);

				// Sync all chat titles to cookies
				for (const chat of mergedChats) {
					ChatTitlesCookieManager.setChatTitle(chat.id, chat.name);
				}
			}
		};

		if (open) {
			setSearchQuery("");
			loadChats();
		}
	}, [open, isLoggedIn, cache.chats, user?.id]);

	React.useEffect(() => {
		const loadAllChatMessages = async () => {
			const messagesMap = new Map<string, LocalMessage[]>();

			for (const chat of chats) {
				try {
					if (!isLoggedIn) {
						const chatMessages = await localChatStorage.getMessages(chat.id);
						messagesMap.set(chat.id, chatMessages);
					} else {
						const [cacheMessages, localMessages] = await Promise.all([
							cache.getMessages(chat.id),
							localChatStorage.getMessages(chat.id, user?.id),
						]);

						const messageMap = new Map();

						for (const msg of localMessages) {
							messageMap.set(msg._id, msg);
						}

						for (const msg of cacheMessages) {
							messageMap.set(msg._id, msg);
						}

						const mergedMessages = Array.from(messageMap.values());
						messagesMap.set(chat.id, mergedMessages);
					}
				} catch (error) {
					console.error(`Failed to load messages for chat ${chat.id}:`, error);
				}
			}

			setChatMessages(messagesMap);
		};

		if (chats.length > 0) {
			loadAllChatMessages();
		}
	}, [chats, isLoggedIn, user?.id, cache]);

	React.useEffect(() => {
		if (!searchQuery.trim()) {
			setFilteredChats(chats);
			return;
		}

		const query = searchQuery.toLowerCase();
		const filtered = chats.filter((chat) => {
			if (chat.name.toLowerCase().includes(query)) {
				return true;
			}

			const messages = chatMessages.get(chat.id) || [];
			return messages.some((message) =>
				message.content.toLowerCase().includes(query),
			);
		});

		setFilteredChats(filtered);
	}, [searchQuery, chats, chatMessages]);

	const handleChatSelect = async (chat: LocalChat) => {
		setSelectedChat(chat);

		// Sync chat title to cookies when selected
		ChatTitlesCookieManager.setChatTitle(chat.id, chat.name);

		if (!chatMessages.has(chat.id)) {
			try {
				if (!isLoggedIn) {
					const chatMessages = await localChatStorage.getMessages(chat.id);
					const sortedMessages = chatMessages.sort(
						(a, b) => a.createdAt - b.createdAt,
					);
					setMessages(sortedMessages);
				} else {
					const [cacheMessages, localMessages] = await Promise.all([
						cache.getMessages(chat.id),
						localChatStorage.getMessages(chat.id, user?.id),
					]);

					const messageMap = new Map();

					for (const msg of localMessages) {
						messageMap.set(msg._id, msg);
					}

					for (const msg of cacheMessages) {
						messageMap.set(msg._id, msg);
					}

					const mergedMessages = Array.from(messageMap.values()).sort(
						(a, b) => a.createdAt - b.createdAt,
					);
					setMessages(mergedMessages);
				}
			} catch (error) {
				console.error(`Failed to load messages for chat ${chat.id}:`, error);
			}
		} else {
			const cachedMessages = chatMessages.get(chat.id) || [];
			const sortedMessages = cachedMessages.sort(
				(a, b) => a.createdAt - b.createdAt,
			);
			setMessages(sortedMessages);
		}
	};

	const handleDeleteClick = (chatId: string) => {
		setChatToDelete(chatId);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!chatToDelete) return;

		try {
			if (!isLoggedIn) {
				await localChatStorage.deleteChat(chatToDelete);
				// Reload chats
				const localChats = await localChatStorage.getChats();
				setChats(localChats);
			} else {
				// For logged users, delete from both cache and local storage
				await Promise.all([
					cache.deleteChat(chatToDelete),
					localChatStorage.deleteChat(chatToDelete),
				]);
			}

			// Clear selected chat if it was the one deleted
			if (selectedChat?.id === chatToDelete) {
				setSelectedChat(null);
				setMessages([]);
			}
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

	const convertToMessageFormat = (localMessage: LocalMessage) => ({
		id: localMessage._id,
		role: localMessage.role as "user" | "assistant" | "system",
		parts: [
			{
				type: "text" as const,
				text: localMessage.content,
			},
		],
		// Provide both so downstream sorters can use either
		createdAt: localMessage.createdAt,
		_creationTime: localMessage._creationTime,
		model: localMessage.model,
		convexId: localMessage._id,
		content: localMessage.content,
	});

	const renderContent = () => {
		if (!selectedChat) {
			return (
				<div className="flex h-full items-center justify-center text-muted-foreground">
					Select a chat to view its messages
				</div>
			);
		}

		return (
			<div className="flex h-full flex-col">
				<div className="flex flex-shrink-0 items-center justify-between border-b p-4">
					<h3 className="font-semibold text-lg">{selectedChat.name}</h3>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
							onClick={() => handleDeleteClick(selectedChat.id)}
							aria-label="Delete chat"
						>
							<Trash className="h-4 w-4" />
						</button>
					</div>
				</div>

				<div className="relative min-h-0 flex-1">
					<Conversation
						messages={messages.map(convertToMessageFormat)}
						status="ready"
						onDelete={() => {}}
						onEdit={() => {}}
						onReload={() => {}}
					/>
				</div>

				<div className="flex-shrink-0 border-t p-4">
					<Link
						href={`/chat/${selectedChat.id}`}
						className="text-primary text-sm hover:underline"
						onClick={() => {
							// Sync chat title to cookies when navigating to full conversation
							ChatTitlesCookieManager.setChatTitle(
								selectedChat.id,
								selectedChat.name,
							);
							onOpenChange(false);
						}}
					>
						View full conversation →
					</Link>
				</div>
			</div>
		);
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="overflow-hidden p-0 md:max-h-[800px] md:max-w-[900px] lg:max-w-[1000px]">
					<DialogTitle className="sr-only">Chat History</DialogTitle>
					<DialogDescription className="sr-only">
						View your chat history and recent conversations.
					</DialogDescription>
					<SidebarProvider className="items-start">
						<Sidebar collapsible="none" className="z-10 hidden md:flex">
							<SidebarContent>
								<SidebarGroup>
									<SidebarGroupContent>
										<div className="p-2">
											<div className="relative">
												<Search className="-translate-y-1/2 absolute top-1/2 left-2 h-4 w-4 transform text-muted-foreground" />
												<Input
													placeholder="Search chats and messages..."
													value={searchQuery}
													onChange={(e) => setSearchQuery(e.target.value)}
													className="h-8 pl-8 text-sm"
												/>
											</div>
										</div>

										<SidebarMenu>
											{filteredChats.map((chat) => (
												<SidebarMenuItem key={chat.id}>
													<SidebarMenuButton
														asChild
														isActive={selectedChat?.id === chat.id}
														onClick={() => handleChatSelect(chat)}
													>
														<button type="button" className="w-full text-left">
															<div className="flex items-center gap-2">
																{chat.parentChatId ? (
																	<GitBranch className="h-4 w-4" />
																) : (
																	<MessageSquare className="h-4 w-4" />
																)}
																<span className="flex-1 truncate">
																	{chat.name}
																</span>
																{chat.isPublic && (
																	<span className="text-muted-foreground text-xs">
																		Public
																	</span>
																)}
															</div>
														</button>
													</SidebarMenuButton>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							</SidebarContent>
						</Sidebar>
						<main className="relative flex h-[800px] flex-1 flex-col overflow-hidden">
							<header className="relative flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
								<div className="flex items-center gap-2 px-4">
									<History className="h-4 w-4" />
									<div
										className="relative z-40 text-sm"
										style={{ color: "var(--muted-foreground)" }}
									>
										Chat History ({filteredChats.length} chats)
									</div>
								</div>
							</header>
							<div className="flex flex-1 flex-col overflow-hidden">
								{renderContent()}
							</div>
						</main>
					</SidebarProvider>
				</DialogContent>
			</Dialog>

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
