"use client";

import * as React from "react";
import { MessageSquare, GitBranch, Share2, X, History } from "lucide-react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useCache } from "~/lib/providers/cache-provider";
import { localChatStorage, type LocalChat, type LocalMessage } from "~/lib/local-chat-storage";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "~/components/ui/dialog";
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

export function HistoryDialog({ 
	open, 
	onOpenChange,
	isLoggedIn
}: { 
	open: boolean; 
	onOpenChange: (open: boolean) => void;
	isLoggedIn: boolean;
}) {
	const { user } = useUser();
	const cache = useCache();
	const [chats, setChats] = React.useState<LocalChat[]>([]);
	const [selectedChat, setSelectedChat] = React.useState<LocalChat | null>(null);
	const [messages, setMessages] = React.useState<LocalMessage[]>([]);

	React.useEffect(() => {
		const loadChats = async () => {
			if (!isLoggedIn) {
				// For non-logged users, load from local storage
				const localChats = await localChatStorage.getChats();
				setChats(localChats);
			} else {
				// For logged users, load from both cache and local storage
				const [cacheChats, localChats] = await Promise.all([
					Promise.resolve(cache.chats.map(chat => ({
						...chat,
						id: chat._id,
					}))),
					localChatStorage.getChats(user?.id)
				]);
				
				// Merge chats, prioritizing cache chats
				const chatMap = new Map();
				
				// Add local chats first
				for (const chat of localChats) {
					chatMap.set(chat._id, chat);
				}
				
				// Override with cache chats
				for (const chat of cacheChats) {
					chatMap.set(chat._id, chat);
				}
				
				const mergedChats = Array.from(chatMap.values()).sort((a, b) => b.createdAt - a.createdAt);
				setChats(mergedChats);
			}
		};

		if (open) {
			loadChats();
		}
	}, [open, isLoggedIn, cache.chats, user?.id]);

	const handleChatSelect = async (chat: LocalChat) => {
		setSelectedChat(chat);
		
		// Load messages for the selected chat
		if (!isLoggedIn) {
			const chatMessages = await localChatStorage.getMessages(chat.id);
			setMessages(chatMessages);
		} else {
			// For logged users, load from both cache and local storage
			const [cacheMessages, localMessages] = await Promise.all([
				cache.getMessages(chat.id),
				localChatStorage.getMessages(chat.id, user?.id)
			]);
			
			// Merge messages, prioritizing cache messages
			const messageMap = new Map();
			
			// Add local messages first
			for (const msg of localMessages) {
				messageMap.set(msg._id, msg);
			}
			
			// Override with cache messages
			for (const msg of cacheMessages) {
				messageMap.set(msg._id, msg);
			}
			
			const mergedMessages = Array.from(messageMap.values()).sort((a, b) => a.createdAt - b.createdAt);
			setMessages(mergedMessages);
		}
	};

	const handleDeleteChat = async (chatId: string) => {
		if (!isLoggedIn) {
			await localChatStorage.deleteChat(chatId);
			// Reload chats
			const updatedChats = await localChatStorage.getChats();
			setChats(updatedChats);
			if (selectedChat?.id === chatId) {
				setSelectedChat(null);
				setMessages([]);
			}
		} else {
			// For logged users, delete from both cache and local storage
			await Promise.all([
				cache.deleteChat(chatId),
				localChatStorage.deleteChat(chatId)
			]);
		}
	};

	const renderContent = () => {
		if (!selectedChat) {
			return (
				<div className="flex items-center justify-center h-full text-muted-foreground">
					Select a chat to view its messages
				</div>
			);
		}

		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-semibold">{selectedChat.name}</h3>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
							onClick={() => {
								// Handle share functionality
							}}
							aria-label="Share chat"
						>
							<Share2 className="h-4 w-4" />
						</button>
						<button
							type="button"
							className="flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
							onClick={() => handleDeleteChat(selectedChat.id)}
							aria-label="Delete chat"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				</div>
				
				<div className="space-y-3 max-h-96 overflow-y-auto">
					{messages.slice(-5).map((message) => (
						<div
							key={message._id}
							className={`p-3 rounded-lg ${
								message.role === "user"
									? "bg-muted ml-auto max-w-[80%]"
									: "bg-muted/50 mr-auto max-w-[80%]"
							}`}
						>
							<div className="text-xs text-muted-foreground mb-1">
								{message.role === "user" ? "You" : "Assistant"}
							</div>
							<div className="text-sm">
								{message.content.length > 200
									? `${message.content.substring(0, 200)}...`
									: message.content}
							</div>
						</div>
					))}
				</div>
				
				<div className="pt-2">
					<Link
						href={`/chat/${selectedChat.id}`}
						className="text-sm text-primary hover:underline"
					>
						View full conversation →
					</Link>
				</div>
			</div>
		);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="overflow-hidden p-0 md:max-h-[800px] md:max-w-[900px] lg:max-w-[1000px] z-50">
				<DialogTitle className="sr-only">Chat History</DialogTitle>
				<DialogDescription className="sr-only">
					View your chat history and recent conversations.
				</DialogDescription>
				<SidebarProvider className="items-start">
					<Sidebar collapsible="none" className="hidden md:flex z-10">
						<SidebarContent>
							<SidebarGroup>
								<SidebarGroupContent>
									<SidebarMenu>
										{chats.map((chat) => (
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
															<span className="flex-1 truncate">{chat.name}</span>
															{chat.isPublic && (
																<span className="text-muted-foreground text-xs">Public</span>
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
					<main className="flex h-[800px] flex-1 flex-col overflow-hidden relative z-20">
						<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 relative z-30">
							<div className="flex items-center gap-2 px-4">
								<History className="h-4 w-4" />
								<div className="text-sm relative z-40" style={{ color: 'var(--muted-foreground)' }}>
									Chat History ({chats.length} chats)
								</div>
							</div>
						</header>
						<div className="flex flex-1 flex-col gap-4 p-4 pt-0 relative z-30">
							{renderContent()}
						</div>
					</main>
				</SidebarProvider>
			</DialogContent>
		</Dialog>
	);
} 