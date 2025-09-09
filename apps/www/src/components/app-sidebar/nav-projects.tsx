"use client";

import type {
	LucideIcon,
} from "lucide-react";
import type { ReactElement } from "react";
import { isValidElement } from "react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";

export function NavProjects({
	projects,
}: {
	projects: {
		name: string;
		url: string;
		icon: LucideIcon | ReactElement;
		activeIcon?: ReactElement;
		badge?: string;
	}[];
}) {
	
	return (
		<SidebarGroup className="group-data-[collapsible=icon]:hidden">
			<SidebarGroupLabel>Use Cases</SidebarGroupLabel>
			<SidebarMenu>
				{projects.map((item) => (
					<SidebarMenuItem key={item.name}>
						<SidebarMenuButton asChild>
							<a href={item.url}>
								{isValidElement(item.icon) ? (
									item.icon
								) : typeof item.icon === "function" ? (
									<item.icon />
								) : null}
								<span>{item.name}</span>
								{item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
							</a>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
