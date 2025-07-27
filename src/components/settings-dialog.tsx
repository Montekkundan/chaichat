"use client";

import * as React from "react";
import {
	Paintbrush,
	Key,
} from "lucide-react";

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
import { ApiKeyManager } from "~/components/api-key-manager";
import { useTheme } from "next-themes";

const data = {
	nav: [
		{ name: "API Keys", icon: Key, id: "api-keys" },
		{ name: "Appearance", icon: Paintbrush, id: "appearance" },
	],
};

type SettingsSection = "api-keys" | "appearance";

export function SettingsDialog({ 
	open, 
	onOpenChange 
}: { 
	open: boolean; 
	onOpenChange: (open: boolean) => void;
}) {
	const [activeSection, setActiveSection] = React.useState<SettingsSection>("api-keys");
	const { resolvedTheme, setTheme } = useTheme();

	const renderContent = () => {
		switch (activeSection) {
			case "api-keys":
				return <ApiKeyManager />;
			case "appearance":
				return (
					<div className="space-y-6">
						<div>
							<h3 className="text-lg font-semibold">Theme</h3>
							<p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.8 }}>
								Customize the appearance of ChaiChat
							</p>
						</div>
						<div className="space-y-4">
							<div className="rounded-lg border bg-card p-4">
								<h4 className="font-medium mb-2">Theme Mode</h4>
								<div className="space-y-2">
									<label className="flex items-center space-x-2">
										<input 
											type="radio" 
											name="theme" 
											value="light" 
											checked={resolvedTheme === "light"}
											onChange={() => setTheme("light")}
											className="rounded" 
										/>
										<span>Light</span>
									</label>
									<label className="flex items-center space-x-2">
										<input 
											type="radio" 
											name="theme" 
											value="dark" 
											checked={resolvedTheme === "dark"}
											onChange={() => setTheme("dark")}
											className="rounded" 
										/>
										<span>Dark</span>
									</label>
									<label className="flex items-center space-x-2">
										<input 
											type="radio" 
											name="theme" 
											value="system" 
											checked={resolvedTheme === "system"}
											onChange={() => setTheme("system")}
											className="rounded" 
										/>
										<span>System</span>
									</label>
								</div>
							</div>
						</div>
					</div>
				);
			default:
				return <ApiKeyManager />;
		}
	};

	const activeNavItem = data.nav.find(item => item.id === activeSection);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="overflow-hidden p-0 md:max-h-[900px] md:max-w-[800px] lg:max-w-[900px] z-50">
				<DialogTitle className="sr-only">Settings</DialogTitle>
				<DialogDescription className="sr-only">
					Customize your settings here.
				</DialogDescription>
				<SidebarProvider className="items-start">
					<Sidebar collapsible="none" className="hidden md:flex z-10">
						<SidebarContent>
							<SidebarGroup>
								<SidebarGroupContent>
									<SidebarMenu>
										{data.nav.map((item) => (
											<SidebarMenuItem key={item.name}>
												<SidebarMenuButton
													asChild
													isActive={item.id === activeSection}
													onClick={() => setActiveSection(item.id as SettingsSection)}
												>
													<button type="button" className="w-full">
														<item.icon className="h-4 w-4" />
														<span>{item.name}</span>
													</button>
												</SidebarMenuButton>
											</SidebarMenuItem>
										))}
									</SidebarMenu>
								</SidebarGroupContent>
							</SidebarGroup>
						</SidebarContent>
					</Sidebar>
					<main className="flex h-[860px] flex-1 flex-col overflow-hidden relative z-20">
						<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 relative z-30">
							<div className="flex items-center gap-2 px-4">
								<div className="text-sm relative z-40" style={{ color: 'var(--muted-foreground)' }}>
									Settings / {activeNavItem?.name || "Settings"}
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