"use client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { Unauthenticated } from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { Button } from "./ui/button";
import { db } from '~/db';
import type { Chat } from '~/db';
import { DeleteChatModal } from '~/components/modals/delete-chat-modal';


export function AppSidebar() {
	const { user } = useUser();
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [chatToDelete, setChatToDelete] = useState<string | null>(null);
	const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
	const [displayedChats, setDisplayedChats] = useState<Chat[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedSearch(search);
		}, 200);
		return () => clearTimeout(handler);
	}, [search]);

	const isSearching = !!search.trim();
	const queryFn = isSearching ? api.chat.searchChats : api.chat.listChats;
	const queryArgs = user
		? isSearching
			? { userId: user.id, query: debouncedSearch }
			: { userId: user.id }
		: "skip";

	const chats = useQuery(queryFn, queryArgs);
	const deleteChat = useMutation(api.chat.deleteChat);

	// Sync Convex chats to Dexie on fetch
	useEffect(() => {
		if (chats && chats.length > 0) {
			db.chats.bulkPut(chats);
		}
	}, [chats]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		let active = true;
		let loadingTimeout: NodeJS.Timeout | null = null;

		// Only show loading if search takes longer than 150ms
		loadingTimeout = setTimeout(() => {
			if (active) setIsLoading(true);
		}, 150);

		async function fetchLocalChats() {
			let result: Chat[] = [];
			if (user) {
				if (debouncedSearch.trim()) {
					result = await db.chats
						.where('userId')
						.equals(user.id)
						.filter(chat => chat.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
						.toArray();
				} else {
					result = await db.chats.where('userId').equals(user.id).toArray();
				}
			}
			if (active) setDisplayedChats(result);
			if (loadingTimeout) clearTimeout(loadingTimeout);
			setIsLoading(false);
		}
		fetchLocalChats();
		return () => {
			active = false;
			if (loadingTimeout) clearTimeout(loadingTimeout);
		};
	}, [user, debouncedSearch, chats]);

	const handleProfileClick = (_e: React.MouseEvent | React.KeyboardEvent) => {
		router.push("/settings/subscription");
	};

	const handleNewChat = async () => {
		router.push("/");
	};

	const handleDeleteClick = (chatId: string) => {
		setChatToDelete(chatId);
		setDeleteModalOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (chatToDelete) {
			await deleteChat({ chatId: chatToDelete as Id<"chats"> });
			// Remove from Dexie (chat and its messages)
			await db.chats.delete(chatToDelete);
			await db.messages.where('chatId').equals(chatToDelete).delete();
			setDisplayedChats((prev) => prev.filter(chat => chat._id !== chatToDelete));
			router.push('/');
			setDeleteModalOpen(false);
			setChatToDelete(null);
		}
	};

	const handleCancelDelete = () => {
		setDeleteModalOpen(false);
		setChatToDelete(null);
	};

	return (
		<Sidebar>
			<SidebarHeader>
				<div className="py-1 text-center text-xl tracking-tight">ChaiChat</div>
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
							onChange={e => setSearch(e.target.value)}
						/>
						<Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
					</div>
				</div>
			</SidebarHeader>
			<SidebarContent>
				<div className="px-2">
					<div className="mb-2 font-semibold text-muted-foreground text-xs">
						Your Chats
					</div>
					<SidebarMenu>
						{isLoading ? (
							<div className="px-4 py-2 text-xs text-muted-foreground">Searching...</div>
						) : (
							displayedChats?.map((chat) => (
								<SidebarMenuItem
									key={chat._id}
									className="relative"
									onMouseEnter={() => setHoveredChatId(chat._id)}
									onMouseLeave={() => setHoveredChatId(null)}
								>
									<SidebarMenuButton asChild>
										<Link href={`/chat/${chat._id}`}>
											<span>{chat.name}</span>
										</Link>
									</SidebarMenuButton>
									{hoveredChatId === chat._id && (
										<button
											type="button"
											className="-translate-y-1/2 absolute top-1/2 right-2 rounded-full p-1 opacity-100 transition-opacity duration-200 hover:bg-destructive/10 hover:text-destructive"
											onClick={(e) => {
												e.preventDefault();
												handleDeleteClick(chat._id);
											}}
											aria-label="Delete chat"
										>
											<X className="size-4" />
										</button>
									)}
								</SidebarMenuItem>
							))
						)}
					</SidebarMenu>
				</div>
			</SidebarContent>
			<SidebarFooter>
				{user ? (
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
							src={user.imageUrl}
							alt={user.fullName || "User"}
							className="h-10 w-10 rounded-full"
						/>
						<div className="flex flex-col items-start">
							<span className="font-semibold">{user.fullName}</span>
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
		</Sidebar>
	);
}
