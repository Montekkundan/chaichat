"use client";

import * as React from "react";
import {
	Paintbrush,
	Key,
	RotateCcw,
	ExternalLink,
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
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ApiKeyManager } from "~/components/api-key-manager";
import { useTheme } from "next-themes";
import { fetchTweakcnTheme, getStoredTweakcnTheme, applyTweakcnTheme, resetToDefaultTheme, isTweakcnThemeActive, TWEAKCN_THEME_RESET_EVENT, type TweakcnThemeState } from "~/lib/tweakcn-theme";
import { toast } from "~/components/ui/toast";

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
	const [tweakcnTheme, setTweakcnTheme] = React.useState<TweakcnThemeState | null>(null);
	const [isTweakcnActive, setIsTweakcnActive] = React.useState(false);
	const [themeUrl, setThemeUrl] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);

	React.useEffect(() => {
		// Check if Tweakcn theme is stored locally
		const storedTheme = getStoredTweakcnTheme();
		setTweakcnTheme(storedTheme);
		setIsTweakcnActive(isTweakcnThemeActive());
	}, []);

	// Listen for theme reset events
	React.useEffect(() => {
		const handleThemeReset = () => {
			setTweakcnTheme(null);
			setIsTweakcnActive(false);
			setThemeUrl("");
		};

		window.addEventListener(TWEAKCN_THEME_RESET_EVENT, handleThemeReset);
		
		return () => {
			window.removeEventListener(TWEAKCN_THEME_RESET_EVENT, handleThemeReset);
		};
	}, []);

	// Sync tweakcn theme with resolvedTheme changes (light/dark mode toggle)
	React.useEffect(() => {
		if (tweakcnTheme && resolvedTheme) {
			const newMode = resolvedTheme === 'dark' ? 'dark' : 'light';
			if (tweakcnTheme.currentMode !== newMode) {
				const syncedTheme = {
					...tweakcnTheme,
					currentMode: newMode as 'dark' | 'light'
				};
				setTweakcnTheme(syncedTheme);
				// Use bypassThrottle for instant mode changes
				applyTweakcnTheme(syncedTheme, true);
			}
		}
	}, [resolvedTheme, tweakcnTheme?.currentMode, tweakcnTheme?.preset]);

	const handleFetchTheme = async () => {
		if (!themeUrl.trim()) {
			toast({ title: "Please enter a theme URL", status: "error" });
			return;
		}

		// Validate URL format
		if (!themeUrl.startsWith("https://tweakcn.com/r/themes/")) {
			toast({ title: "Please use a valid Tweakcn theme URL (https://tweakcn.com/r/themes/...)", status: "error" });
			return;
		}

		setIsLoading(true);
		try {
			const theme = await fetchTweakcnTheme(themeUrl);
			if (theme) {
				// Sync the theme mode with current next-themes mode
				const syncedTheme = {
					...theme,
					currentMode: (resolvedTheme === 'dark' ? 'dark' : 'light') as 'dark' | 'light'
				};
				setTweakcnTheme(syncedTheme);
				// Automatically apply the theme
				applyTweakcnTheme(syncedTheme);
				setIsTweakcnActive(true);
				toast({ title: "Theme fetched and applied!", status: "success" });
			} else {
				toast({ title: "Failed to fetch theme - invalid JSON response", status: "error" });
			}
		} catch (error) {
			toast({ title: "Error fetching theme - please check the URL", status: "error" });
		} finally {
			setIsLoading(false);
		}
	};

	// Auto-fetch when URL changes (with debounce and validation)
	React.useEffect(() => {
		if (!themeUrl.trim()) {
			// If URL is cleared, reset the theme
			if (tweakcnTheme) {
				resetToDefaultTheme();
				setTweakcnTheme(null);
				setIsTweakcnActive(false);
				toast({ title: "Theme reset to default", status: "success" });
			}
			return;
		}
		
		// Validate URL format
		if (!themeUrl.startsWith("https://tweakcn.com/r/themes/")) {
			return; // Don't auto-fetch invalid URLs
		}
		
		const timeoutId = setTimeout(async () => {
			setIsLoading(true);
			try {
				const theme = await fetchTweakcnTheme(themeUrl);
				if (theme) {
					const syncedTheme = {
						...theme,
						currentMode: (resolvedTheme === 'dark' ? 'dark' : 'light') as 'dark' | 'light'
					};
					setTweakcnTheme(syncedTheme);
					applyTweakcnTheme(syncedTheme);
					setIsTweakcnActive(true);
					toast({ title: "Theme automatically applied!", status: "success" });
				} else {
					toast({ title: "Failed to fetch theme - invalid JSON response", status: "error" });
				}
			} catch (error) {
				toast({ title: "Error fetching theme - please check the URL", status: "error" });
			} finally {
				setIsLoading(false);
			}
		}, 1000);

		return () => clearTimeout(timeoutId);
	}, [themeUrl, resolvedTheme]);

	const handleApplyTweakcnTheme = () => {
		if (tweakcnTheme) {
			const syncedTheme = {
				...tweakcnTheme,
				currentMode: (resolvedTheme === 'dark' ? 'dark' : 'light') as 'dark' | 'light'
			};
			applyTweakcnTheme(syncedTheme);
			setIsTweakcnActive(true);
			toast({ title: "Tweakcn theme applied!", status: "success" });
		} else {
			toast({ title: "No theme to apply", status: "error" });
		}
	};

	const handleResetTheme = () => {
		resetToDefaultTheme();
		toast({ title: "Theme reset to default", status: "success" });
	};

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

							<div className="rounded-lg border bg-card p-4">
								<h4 className="font-medium mb-2">Tweakcn Theme</h4>
								<p className="text-sm text-muted-foreground mb-4">
									Import themes from Tweakcn.com via URL
								</p>
								
								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-2">
											<span className="text-sm">Theme Status:</span>
											{tweakcnTheme ? (
												<span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
													Loaded ({tweakcnTheme.preset})
												</span>
											) : (
												<span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
													No theme loaded
												</span>
											)}
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => window.open("https://tweakcn.com", "_blank")}
										>
											<ExternalLink className="h-4 w-4 mr-1" />
											Visit Tweakcn
										</Button>
									</div>

									{/* URL Import */}
									<div className="space-y-2">
										<label htmlFor="theme-url" className="text-sm font-medium">Theme URL (auto-applies):</label>
										<Input
											id="theme-url"
											placeholder="https://tweakcn.com/r/themes/twitter.json"
											value={themeUrl}
											onChange={(e) => setThemeUrl(e.target.value)}
											className="flex-1"
										/>
										{isLoading && (
											<div className="text-xs text-muted-foreground">
												Loading theme...
											</div>
										)}
									</div>

									<div className="flex space-x-2">
										<Button
											onClick={handleResetTheme}
											variant="outline"
											size="sm"
											disabled={!isTweakcnActive}
											className="flex-1"
										>
											<RotateCcw className="h-4 w-4 mr-1" />
											Reset to Default
										</Button>
									</div>

									{isTweakcnActive && (
										<div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
											Tweakcn theme is currently active
										</div>
									)}
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
			<DialogContent className="overflow-hidden p-0 md:max-h-[900px] md:max-w-[800px] lg:max-w-[900px]">
				<DialogTitle className="sr-only">Settings</DialogTitle>
				<DialogDescription className="sr-only">
					Customize your settings here.
				</DialogDescription>
				<SidebarProvider className="items-start">
					<Sidebar collapsible="none" className="hidden md:flex">
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
					<main className="flex h-[860px] flex-1 flex-col overflow-hidden relative">
						<header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 relative">
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