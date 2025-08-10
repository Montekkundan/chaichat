"use client";

import { GearIcon } from "@phosphor-icons/react";
import { ExternalLink, Key, RotateCcw } from "lucide-react";
import * as React from "react";

import { useTheme } from "next-themes";
import { ApiKeyManager } from "~/components/api-key-manager";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
import { toast } from "~/components/ui/toast";
import {
	TWEAKCN_THEME_RESET_EVENT,
	type TweakcnThemeState,
	applyTweakcnTheme,
	fetchTweakcnTheme,
	getStoredTweakcnTheme,
	isTweakcnThemeActive,
	resetToDefaultTheme,
} from "~/lib/tweakcn-theme";

const data = {
	nav: [
		{ name: "API Keys", icon: Key, id: "api-keys" },
		{ name: "Appearance", icon: GearIcon, id: "appearance" },
	],
};

type SettingsSection = "api-keys" | "appearance";

export function SettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [activeSection, setActiveSection] =
		React.useState<SettingsSection>("api-keys");
	const { resolvedTheme, setTheme } = useTheme();
	const [tweakcnTheme, setTweakcnTheme] =
		React.useState<TweakcnThemeState | null>(null);
	const [isTweakcnActive, setIsTweakcnActive] = React.useState(false);
	const [themeUrl, setThemeUrl] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);
	const [isRestoringUrl, setIsRestoringUrl] = React.useState(true);
	const [isUserAction, setIsUserAction] = React.useState(false);

	const apiKeyManagerComponent = React.useMemo(() => <ApiKeyManager />, []);

	React.useEffect(() => {
		// Let the theme provider handle initial restoration
		// Just sync the component state with what's stored
		const syncWithStoredTheme = () => {
			const storedTheme = getStoredTweakcnTheme();
			const isActive = isTweakcnThemeActive();

			setTweakcnTheme(storedTheme);
			setIsTweakcnActive(isActive);

			// Restore the theme URL from localStorage if available
			try {
				const storedUrl = localStorage.getItem("chai-tweakcn-theme-url");
				if (storedUrl && storedTheme) {
					setThemeUrl(storedUrl);
				}
			} catch (error) {
				console.error("Failed to restore theme URL:", error);
			}

			// Mark restoration as complete
			setIsRestoringUrl(false);
		};

		// Initial sync after a brief delay to let theme provider initialize
		const timeoutId = setTimeout(syncWithStoredTheme, 150);

		return () => clearTimeout(timeoutId);
	}, []);

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

	React.useEffect(() => {
		if (tweakcnTheme && resolvedTheme) {
			const newMode = resolvedTheme === "dark" ? "dark" : "light";
			if (tweakcnTheme.currentMode !== newMode) {
				const syncedTheme = {
					...tweakcnTheme,
					currentMode: newMode as "dark" | "light",
				};
				setTweakcnTheme(syncedTheme);
				applyTweakcnTheme(syncedTheme, true);
			}
		}
	}, [resolvedTheme, tweakcnTheme]);

	const handleFetchTheme = async () => {
		if (!themeUrl.trim()) {
			toast({ title: "Please enter a theme URL", status: "error" });
			return;
		}

		if (!themeUrl.startsWith("https://tweakcn.com/r/themes/")) {
			toast({
				title:
					"Please use a valid Tweakcn theme URL (https://tweakcn.com/r/themes/...)",
				status: "error",
			});
			return;
		}

		setIsLoading(true);
		setIsUserAction(true); // Mark as user action
		try {
			const theme = await fetchTweakcnTheme(themeUrl);
			if (theme) {
				const syncedTheme = {
					...theme,
					currentMode: (resolvedTheme === "dark" ? "dark" : "light") as
						| "dark"
						| "light",
				};
				setTweakcnTheme(syncedTheme);
				applyTweakcnTheme(syncedTheme);
				setIsTweakcnActive(true);

				// Persist the theme URL
				try {
					localStorage.setItem("chai-tweakcn-theme-url", themeUrl);
				} catch (error) {
					console.error("Failed to store theme URL:", error);
				}

				toast({ title: "Theme fetched and applied!", status: "success" });
			} else {
				toast({
					title: "Failed to fetch theme - invalid JSON response",
					status: "error",
				});
			}
		} catch (error) {
			toast({
				title: "Error fetching theme - please check the URL",
				status: "error",
			});
		} finally {
			setIsLoading(false);
			setIsUserAction(false); // Reset the flag
		}
	};

	React.useEffect(() => {
		// Don't process empty URLs during restoration phase
		if (!themeUrl.trim()) {
			// Only reset theme if we're not in the restoration phase and there was a theme active
			if (!isRestoringUrl && tweakcnTheme) {
				resetToDefaultTheme();
				setTweakcnTheme(null);
				setIsTweakcnActive(false);
				// Also clear the stored URL
				try {
					localStorage.removeItem("chai-tweakcn-theme-url");
				} catch (error) {
					console.error("Failed to clear theme URL:", error);
				}
				toast({ title: "Theme reset to default", status: "success" });
			}
			return;
		}

		if (!themeUrl.startsWith("https://tweakcn.com/r/themes/")) {
			return;
		}

		const timeoutId = setTimeout(async () => {
			setIsLoading(true);
			try {
				const theme = await fetchTweakcnTheme(themeUrl);
				if (theme) {
					const syncedTheme = {
						...theme,
						currentMode: (resolvedTheme === "dark" ? "dark" : "light") as
							| "dark"
							| "light",
					};
					setTweakcnTheme(syncedTheme);
					applyTweakcnTheme(syncedTheme);
					setIsTweakcnActive(true);

					// Persist the theme URL
					try {
						localStorage.setItem("chai-tweakcn-theme-url", themeUrl);
					} catch (error) {
						console.error("Failed to store theme URL:", error);
					}

					// Only show toast for user-initiated actions, not during restoration
					if (isUserAction) {
						toast({ title: "Theme automatically applied!", status: "success" });
					}
				} else {
					if (isUserAction) {
						toast({
							title: "Failed to fetch theme - invalid JSON response",
							status: "error",
						});
					}
				}
			} catch (error) {
				if (isUserAction) {
					toast({
						title: "Error fetching theme - please check the URL",
						status: "error",
					});
				}
			} finally {
				setIsLoading(false);
				setIsUserAction(false); // Reset the flag
			}
		}, 1000);

		return () => clearTimeout(timeoutId);
	}, [themeUrl, resolvedTheme, isRestoringUrl]); // Added isRestoringUrl, removed tweakcnTheme to prevent infinite loop

	const handleApplyTweakcnTheme = () => {
		if (tweakcnTheme) {
			const syncedTheme = {
				...tweakcnTheme,
				currentMode: (resolvedTheme === "dark" ? "dark" : "light") as
					| "dark"
					| "light",
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
		setTweakcnTheme(null);
		setIsTweakcnActive(false);
		setThemeUrl("");
		setIsRestoringUrl(false); // Ensure we're not in restoration mode

		// Clear the stored URL
		try {
			localStorage.removeItem("chai-tweakcn-theme-url");
		} catch (error) {
			console.error("Failed to clear theme URL:", error);
		}

		toast({ title: "Theme reset to default", status: "success" });
	};

	const renderContent = () => {
		switch (activeSection) {
			case "api-keys":
				return apiKeyManagerComponent;
			case "appearance":
				return (
					<div className="space-y-6">
						<div>
							<h3 className="font-semibold text-lg">Theme</h3>
							<p
								className="text-sm"
								style={{ color: "var(--foreground)", opacity: 0.8 }}
							>
								Customize the appearance of ChaiChat
							</p>
						</div>
						<div className="space-y-4">
							<div className="rounded-lg border bg-card p-4">
								<h4 className="mb-2 font-medium">Theme Mode</h4>
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
								<h4 className="mb-2 font-medium">Tweakcn Theme</h4>
								<p className="mb-4 text-muted-foreground text-sm">
									Import themes from Tweakcn.com via URL
								</p>

								<div className="space-y-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-2">
											<span className="text-sm">Theme Status:</span>
											{tweakcnTheme ? (
												<span className="rounded bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900 dark:text-green-200">
													Loaded ({tweakcnTheme.preset})
												</span>
											) : (
												<span className="rounded bg-gray-100 px-2 py-1 text-gray-600 text-xs dark:bg-gray-800 dark:text-gray-400">
													No theme loaded
												</span>
											)}
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												window.open("https://tweakcn.com", "_blank")
											}
										>
											<ExternalLink className="mr-1 h-4 w-4" />
											Visit Tweakcn
										</Button>
									</div>

									{/* URL Import */}
									<div className="space-y-2">
										<label htmlFor="theme-url" className="font-medium text-sm">
											Theme URL (auto-applies):
										</label>
										<Input
											id="theme-url"
											placeholder="https://tweakcn.com/r/themes/twitter.json"
											value={themeUrl}
											onChange={(e) => {
												setThemeUrl(e.target.value);
												setIsUserAction(true); // Mark as user action
											}}
											className="flex-1"
										/>
										{isLoading && (
											<div className="text-muted-foreground text-xs">
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
											<RotateCcw className="mr-1 h-4 w-4" />
											Reset to Default
										</Button>
									</div>

									{isTweakcnActive && (
										<div className="rounded bg-green-50 p-2 text-green-600 text-xs dark:bg-green-900/20 dark:text-green-400">
											Tweakcn theme is currently active
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				);
			default:
				return apiKeyManagerComponent;
		}
	};

	const activeNavItem = data.nav.find((item) => item.id === activeSection);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="overflow-hidden p-0 md:max-h-[90vh] md:max-w-[900px] lg:max-w-[1200px]">
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
													onClick={() =>
														setActiveSection(item.id as SettingsSection)
													}
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
					<main className="relative flex h-[90vh] flex-1 flex-col overflow-hidden">
						<header className="relative flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
							<div className="flex items-center gap-2 px-4">
								<div
									className="relative z-40 text-sm"
									style={{ color: "var(--muted-foreground)" }}
								>
									Settings / {activeNavItem?.name || "Settings"}
								</div>
							</div>
						</header>
						<div className="relative z-30 flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
							{renderContent()}
						</div>
					</main>
				</SidebarProvider>
			</DialogContent>
		</Dialog>
	);
}
