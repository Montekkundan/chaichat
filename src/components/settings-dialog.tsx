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
	PLAYGROUND_MAX_COLUMNS_CHANGED_EVENT,
	PLAYGROUND_MAX_COLUMNS_DEFAULT,
	PLAYGROUND_MAX_COLUMNS_MAX,
	PLAYGROUND_MAX_COLUMNS_MIN,
	PLAYGROUND_MAX_COLUMNS_STORAGE_KEY,
} from "~/lib/config";
import {
	TWEAKCN_THEME_RESET_EVENT,
	type TweakcnThemeState,
	applyTweakcnTheme,
	fetchTweakcnTheme,
	getStoredTweakcnTheme,
	isTweakcnThemeActive,
	resetToDefaultTheme,
} from "~/lib/tweakcn-theme";
import { cn } from "~/lib/utils";

const data = {
	nav: [
		{ name: "API Keys", icon: Key, id: "api-keys" },
		{ name: "Appearance", icon: GearIcon, id: "appearance" },
		{ name: "Playground", icon: GearIcon, id: "playground" },
	],
};

type SettingsSection = "api-keys" | "appearance" | "playground";

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
	const [maxColumns, setMaxColumns] = React.useState<number>(3);
	const [maxColumnsInput, setMaxColumnsInput] = React.useState<string>("3");

	// Track last applied URL to avoid redundant fetches and flicker
	const lastAppliedUrlRef = React.useRef<string | null>(null);

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
					// We already have a stored theme; skip re-fetching the same URL
					lastAppliedUrlRef.current = storedUrl;
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

	React.useEffect(() => {
		try {
			const raw = localStorage.getItem(PLAYGROUND_MAX_COLUMNS_STORAGE_KEY);
			const parsed = raw
				? Number.parseInt(raw)
				: PLAYGROUND_MAX_COLUMNS_DEFAULT;
			const clamped = Math.min(
				Math.max(
					Number.isNaN(parsed) ? PLAYGROUND_MAX_COLUMNS_DEFAULT : parsed,
					PLAYGROUND_MAX_COLUMNS_MIN,
				),
				PLAYGROUND_MAX_COLUMNS_MAX,
			);
			setMaxColumns(clamped);
			setMaxColumnsInput(String(clamped));
		} catch {}
	}, []);

	const commitMaxColumns = (value: number) => {
		const clamped = Math.min(
			Math.max(
				Number.isNaN(value) ? PLAYGROUND_MAX_COLUMNS_DEFAULT : value,
				PLAYGROUND_MAX_COLUMNS_MIN,
			),
			PLAYGROUND_MAX_COLUMNS_MAX,
		);
		setMaxColumns(clamped);
		setMaxColumnsInput(String(clamped));
		try {
			localStorage.setItem(PLAYGROUND_MAX_COLUMNS_STORAGE_KEY, String(clamped));
			window.dispatchEvent(
				new CustomEvent<number>(PLAYGROUND_MAX_COLUMNS_CHANGED_EVENT, {
					detail: clamped,
				}),
			);
			toast({ title: "Max columns updated", status: "success" });
		} catch (err) {
			console.error(err);
			toast({ title: "Failed to save setting", status: "error" });
		}
	};
	const handleMaxColumnsInputChange = (value: string) => {
		setMaxColumnsInput(value);
		const parsed = Number.parseInt(value);
		if (!Number.isNaN(parsed)) {
			commitMaxColumns(parsed);
		}
	};

	React.useEffect(() => {
		if (!themeUrl.trim()) {
			if (!isRestoringUrl && tweakcnTheme) {
				resetToDefaultTheme();
				setTweakcnTheme(null);
				setIsTweakcnActive(false);
				lastAppliedUrlRef.current = null;
				try {
					localStorage.removeItem("chai-tweakcn-theme-url");
				} catch (error) {
					console.error("Failed to clear theme URL:", error);
				}
				toast({ title: "Theme reset to default", status: "success" });
			}
			return;
		}

		// Only handle valid tweakcn URLs
		if (!themeUrl.startsWith("https://tweakcn.com/r/themes/")) {
			return;
		}

		// Skip if we're restoring and already have this URL applied
		if (lastAppliedUrlRef.current === themeUrl) {
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

					// Persist the theme URL and mark as applied to avoid refetch loop
					try {
						localStorage.setItem("chai-tweakcn-theme-url", themeUrl);
						lastAppliedUrlRef.current = themeUrl;
					} catch (error) {
						console.error("Failed to store theme URL:", error);
					}

					if (isUserAction) {
						toast({ title: "Theme automatically applied!", status: "success" });
					}
				} else if (isUserAction) {
					toast({
						title: "Failed to fetch theme - invalid JSON response",
						status: "error",
					});
				}
			} catch {
				if (isUserAction) {
					toast({
						title: "Error fetching theme - please check the URL",
						status: "error",
					});
				}
			} finally {
				setIsLoading(false);
				setIsUserAction(false);
			}
		}, 600);

		return () => clearTimeout(timeoutId);
		// Only re-run when the URL text changes or restoration status flips
	}, [themeUrl, isRestoringUrl, resolvedTheme, isUserAction, tweakcnTheme]);

	const handleResetTheme = () => {
		resetToDefaultTheme();
		setTweakcnTheme(null);
		setIsTweakcnActive(false);
		setThemeUrl("");
		setIsRestoringUrl(false);
		lastAppliedUrlRef.current = null;

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
			case "playground":
				return (
					<div className="space-y-6">
						<div>
							<h3 className="font-semibold text-lg">Playground</h3>
							<p
								className="text-sm"
								style={{ color: "var(--foreground)", opacity: 0.8 }}
							>
								Configure playground limits
							</p>
						</div>
						{/* biome-ignore lint/nursery/useSortedClasses: keep logical grouping */}
						<div className={cn("bg-card border p-4 rounded-lg space-y-3")}>
							<h4 className="font-medium">Max Columns</h4>
							<p className="text-muted-foreground text-xs">
								Minimum {PLAYGROUND_MAX_COLUMNS_MIN}, maximum{" "}
								{PLAYGROUND_MAX_COLUMNS_MAX}. Default is{" "}
								{PLAYGROUND_MAX_COLUMNS_DEFAULT}.
							</p>
							<div className="flex items-center gap-2">
								<Input
									id="max-columns"
									type="number"
									min={PLAYGROUND_MAX_COLUMNS_MIN}
									max={PLAYGROUND_MAX_COLUMNS_MAX}
									value={maxColumnsInput}
									onChange={(e) => handleMaxColumnsInputChange(e.target.value)}
									onBlur={() => {
										if (
											maxColumnsInput.trim() === "" ||
											Number.isNaN(Number.parseInt(maxColumnsInput))
										) {
											setMaxColumnsInput(String(maxColumns));
										}
									}}
									className="h-8 w-24"
								/>
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
