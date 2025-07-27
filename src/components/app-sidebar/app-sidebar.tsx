"use client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import {
	MessageSquare,
	Plus,
	// Settings,
	Bot,
	SquareTerminal,
	BookOpen,
	Settings2,
	Frame,
	// User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShareChatModal } from "~/components/modals/share-chat-modal";
import {
	Sidebar,
	SidebarContent,
	// SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { toast } from "~/components/ui/toast";
import { useCache } from "~/lib/providers/cache-provider";
import { DeleteChatModal } from "~/components/modals/delete-chat-modal";
// import { NavMain } from "./nav-main";
import { NavTop } from "./nav-top";
import { Separator } from "../ui/separator";
import { HistorySection } from "./history-section";
import { HouseLine } from "@phosphor-icons/react";

export function AppSidebar({
	initialUser,
	...props
}: {
	initialUser?: {
		id: string;
		fullName?: string | null;
		firstName?: string | null;
		imageUrl?: string;
	};
} & React.ComponentProps<typeof Sidebar>) {

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

	const handleNewChat = async () => {
		// For non-logged users, just navigate to home without redirecting to login
		router.push("/");
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
				userId: effectiveUser?.id ?? "",
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

	// Define data object after all functions are defined
	const data = {
		navTop: [
			{
				title: "New Request",
				icon: Plus,
				onClick: handleNewChat,
			},
			// {
			// 	title: "Notifications",
			// 	icon: Bell,
			// },
			{
				title: "Home",
				icon: <HouseLine size={16} />,
				activeIcon: <HouseLine size={16} weight="duotone" />,
				onClick: () => router.push("/"),
			},
			// {
			// 	title: "Tasks",
			// 	icon: List,
			// },
		],
		navMain: [
		  {
			title: "Playground",
			url: "#",
			icon: SquareTerminal,
			isActive: true,
			items: [
			  {
				title: "Starred",
				url: "#",
			  },
			  {
				title: "Settings",
				url: "#",
			  },
			],
		  },
		  {
			title: "Models",
			url: "#",
			icon: Bot,
			items: [
			  {
				title: "Genesis",
				url: "#",
			  },
			  {
				title: "Explorer",
				url: "#",
			  },
			  {
				title: "Quantum",
				url: "#",
			  },
			],
		  },
		  {
			title: "Documentation",
			url: "#",
			icon: BookOpen,
			items: [
			  {
				title: "Introduction",
				url: "#",
			  },
			  {
				title: "Get Started",
				url: "#",
			  },
			  {
				title: "Tutorials",
				url: "#",
			  },
			  {
				title: "Changelog",
				url: "#",
			  },
			],
		  },
		  {
			title: "Settings",
			url: "#",
			icon: Settings2,
			items: [
			  {
				title: "General",
				url: "#",
			  },
			  {
				title: "Team",
				url: "#",
			  },
			  {
				title: "Billing",
				url: "#",
			  },
			  {
				title: "Limits",
				url: "#",
			  },
			],
		  },
		],
		projects: [
		  {
			name: "Architecture",
			url: "#",
			icon: Frame,
		  }
		],
	};


	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link href="/">
								<MessageSquare className="h-6 w-6" />
								<span className="text-xl font-semibold">ChaiChat</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<NavTop items={data.navTop} />
				<Separator className="!w-[90%] mx-auto"/>
				{/* <NavProjects projects={data.projects} />
				<Separator className="!w-[90%] mx-auto"/> */}
				{/* <NavMain items={data.navMain} />
				<Separator className="!w-[90%] mx-auto"/> */}
				<HistorySection/>
			</SidebarContent>

			{/* <SidebarFooter>

						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link href="/settings">
										<Settings className="h-4 w-4" />
										<span>Settings</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>

							{effectiveUser ? (
								<SidebarMenuItem>
									<SidebarMenuButton asChild>
										<Link href="/settings" className="flex items-center gap-3">
											<img
												src={effectiveUser.imageUrl ?? ""}
												alt={effectiveUser.fullName || "User"}
												className="h-8 w-8 rounded-full"
											/>
											<div className="flex flex-col items-start text-left">
												<span className="font-medium text-sm">
													{effectiveUser.fullName ?? effectiveUser.firstName}
												</span>
											</div>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : (
								<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link href="/settings">
										<User className="h-4 w-4" />
										<span>Sign In</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
							)}
						</SidebarMenu>
			</SidebarFooter> 
			*/}

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
