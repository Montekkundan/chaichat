"use client";

import {
	ChevronRight,
	GitBranch,
	type LucideIcon,
	MessageSquare,
} from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { isValidElement } from "react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";

export function NavMain({
	items,
}: {
	items: {
		title: string;
		url: string;
		icon?: LucideIcon | ReactElement;
		activeIcon?: ReactElement;
		isActive?: boolean;
		items?: {
			title: string;
			url: string;
			chatId?: string;
			isPublic?: boolean;
			isBranch?: boolean;
		}[];
	}[];
}) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Platform</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<Collapsible
						key={item.title}
						asChild
						defaultOpen={item.isActive}
						className="group/collapsible"
					>
						<SidebarMenuItem>
							<CollapsibleTrigger asChild>
								<SidebarMenuButton tooltip={item.title}>
									{item.icon &&
										(item.isActive && item.activeIcon ? (
											item.activeIcon
										) : isValidElement(item.icon) ? (
											item.icon
										) : typeof item.icon === "function" ? (
											<item.icon className="h-4 w-4" />
										) : null)}
									<span>{item.title}</span>
									<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
								</SidebarMenuButton>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<SidebarMenuSub>
									{item.items?.map((subItem) => (
										<SidebarMenuSubItem key={subItem.title}>
											<SidebarMenuSubButton asChild>
												<Link
													href={subItem.url}
													className="flex items-center gap-2"
												>
													{subItem.chatId ? (
														subItem.isBranch ? (
															<GitBranch className="h-3 w-3" />
														) : (
															<MessageSquare className="h-3 w-3" />
														)
													) : null}
													<span className="flex-1 truncate">
														{subItem.title}
													</span>
													{subItem.isPublic && (
														<span className="text-muted-foreground text-xs">
															Public
														</span>
													)}
												</Link>
											</SidebarMenuSubButton>
										</SidebarMenuSubItem>
									))}
								</SidebarMenuSub>
							</CollapsibleContent>
						</SidebarMenuItem>
					</Collapsible>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
