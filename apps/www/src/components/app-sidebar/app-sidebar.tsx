"use client";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { CashRegisterIcon, FilesIcon, HouseLineIcon } from "@phosphor-icons/react";
import { useMutation } from "convex/react";
import {
	BookOpen,
	Bot,
	Frame,
	MessageSquare,
	Plus,
	Settings2,
	SquareTerminal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DeleteChatModal } from "~/components/modals/delete-chat-modal";
import { ShareChatModal } from "~/components/modals/share-chat-modal";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
 	useSidebar,
} from "~/components/ui/sidebar";
import { toast } from "~/components/ui/toast";
import { useCache } from "~/lib/providers/cache-provider";
import { Separator } from "../ui/separator";
import { HistorySection } from "./history-section";
// import { NavMain } from "./nav-main";
import { NavTop } from "./nav-top";


export function AppSidebar({
	initialUser,
	collapsible,
	...props
}: {
	initialUser?: {
		id: string;
		fullName?: string | null;
		firstName?: string | null;
		imageUrl?: string;
	};
	collapsible?: "offcanvas" | "icon" | "none";
} & React.ComponentProps<typeof Sidebar>) {
	const { user } = useUser();
	const router = useRouter();
	const cache = useCache();
	const [_search, _setSearch] = useState("");
	const [_debouncedSearch, _setDebouncedSearch] = useState("");
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [chatToDelete, setChatToDelete] = useState<string | null>(null);
	const toggleVisibility = useMutation(api.chat.toggleChatVisibility);
	const [shareChatId, setShareChatId] = useState<string | null>(null);
	const { state } = useSidebar();
	const _isCollapsed = state === "collapsed";

	const effectiveUser = user ?? initialUser;

	useEffect(() => {
		const handler = setTimeout(() => {
			_setDebouncedSearch(_search);
		}, 200);
		return () => clearTimeout(handler);
	}, [_search]);

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

	const data = {
		navTop: [
			{
				title: "New Request",
				icon: <Plus size={16} />,
				onClick: handleNewChat,
			},
			{
				title: "Home",
				icon: <HouseLineIcon size={16} />,
				activeIcon: <HouseLineIcon size={16} weight="duotone" />,
				onClick: () => router.push("/"),
			},
			{
				title: "Playground",
				icon: <SquareTerminal size={16} />,
				onClick: () => router.push("/playground"),
			},
			// {
			// 	title: "Flow",
			// 	icon: <FlowArrowIcon size={16} />,
			// 	activeIcon: <FlowArrowIcon size={16} weight="duotone" />,
			// 	onClick: () => router.push("/flow"),
			// },
			{
				title: "Registry",
				icon: <CashRegisterIcon size={16} />,
				activeIcon: <CashRegisterIcon size={16} weight="duotone" />,
				onClick: () => router.push("/registry"),
			},
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
			},
		],
	};

	return (
		<Sidebar className="z-21" collapsible={collapsible || "icon"} {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link href="/">
								<MessageSquare className="h-6 w-6" />
								<span className="font-semibold text-xl">ChaiChat</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<NavTop items={data.navTop} />
				<Separator className="!w-[90%] mx-auto" />
				{/* <NavProjects projects={data.projects} />
				<Separator className="!w-[90%] mx-auto"/> */}
				{/* <NavMain items={data.navMain} />
				<Separator className="!w-[90%] mx-auto"/> */}
				<HistorySection />
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild>
							<Link href="/changelog">
								<FilesIcon size={32} />
								<span>Changelog</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>

					{/* {effectiveUser ? (
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
							)} */}
				</SidebarMenu>
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
			<SidebarRail />
		</Sidebar>
	);
}
