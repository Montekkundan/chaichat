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
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
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

export function AppSidebar() {
	const { user } = useUser();
	const router = useRouter();
	const chats = useQuery(
		api.chat.listChats,
		user ? { userId: user.id } : "skip",
	);
	const deleteChat = useMutation(api.chat.deleteChat);

	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [chatToDelete, setChatToDelete] = useState<string | null>(null);
	const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);

	const handleProfileClick = (e: React.MouseEvent | React.KeyboardEvent) => {
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
						{chats?.map((chat) => (
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
								{/* Delete icon, only visible on hover of this item */}
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
						))}
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

			{/* Delete confirmation modal */}
			<Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
				<DialogContent className="max-w-md rounded-2xl bg-muted p-0 text-muted-foreground">
					<div className="p-6 pb-2">
						<DialogTitle className="mb-2 font-semibold text-lg text-white">
							Delete Chat
						</DialogTitle>
						<div className="mb-4 border-white/10 border-b" />
						<div className="mb-6 text-sm text-white/80">
							Are you sure you want to delete this chat and all its messages?
							This action cannot be undone.
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="ghost" onClick={handleCancelDelete}>
								Cancel
							</Button>
							<Button variant="destructive" onClick={handleConfirmDelete}>
								Delete
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</Sidebar>
	);
}
