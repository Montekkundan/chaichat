"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	TWEAKCN_THEME_RESET_EVENT,
	type TweakcnThemeState,
	applyTweakcnTheme,
	fetchTweakcnTheme,
	getStoredTweakcnTheme,
	isTweakcnThemeActive,
	resetToDefaultTheme,
} from "~/lib/tweakcn-theme";

interface SettingsAppearanceProps {
	className?: string;
}

export function SettingsAppearance({ className }: SettingsAppearanceProps) {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [tweakcnTheme, setTweakcnTheme] =
		React.useState<TweakcnThemeState | null>(null);
	const [isTweakcnActive, setIsTweakcnActive] = React.useState(false);
	const [themeUrl, setThemeUrl] = React.useState("");
	const [isLoading, setIsLoading] = React.useState(false);
	const [mounted, setMounted] = React.useState(false);
	const [isRestoringUrl, setIsRestoringUrl] = React.useState(true); // Track restoration phase
	const [isUserAction, setIsUserAction] = React.useState(false); // Track if it's user-initiated

	React.useEffect(() => {
		setMounted(true);

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
	}, [resolvedTheme, tweakcnTheme?.currentMode]); // Only depend on the mode, not the entire theme

	React.useEffect(() => {
		// Don't process empty URLs during initial mount when restoring from localStorage
		if (!themeUrl.trim()) {
			// Only reset theme if we're not in the restoration phase and there was a theme active
			if (!isRestoringUrl && mounted && tweakcnTheme) {
				resetToDefaultTheme();
				setTweakcnTheme(null);
				setIsTweakcnActive(false);
				// Also clear the stored URL
				try {
					localStorage.removeItem("chai-tweakcn-theme-url");
				} catch (error) {
					console.error("Failed to clear theme URL:", error);
				}
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
				} else {
					console.error("Failed to load theme");
				}
			} catch (error) {
				console.error("Error fetching theme:", error);
			} finally {
				setIsLoading(false);
				setIsUserAction(false); // Reset the flag
			}
		}, 1000);

		return () => clearTimeout(timeoutId);
	}, [themeUrl, resolvedTheme, mounted, isRestoringUrl]); // Added isRestoringUrl to dependencies

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

		// Force a re-render to ensure UI updates
		setTimeout(() => {
			setMounted(false);
			setTimeout(() => setMounted(true), 50);
		}, 100);
	};

	if (!mounted) {
		return null;
	}

	return (
		<div className={className}>
			<div className="space-y-4">
				<div>
					<h2 className="font-bold text-xl">Appearance</h2>
					<p className="text-muted-foreground text-sm">
						Customize the appearance of your application.
					</p>
				</div>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Theme Mode</CardTitle>
						<CardDescription className="text-xs">
							Select the theme mode for the application.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-3 gap-3">
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									value="light"
									id="light"
									checked={theme === "light"}
									onChange={(e) => setTheme(e.target.value)}
									className="rounded"
								/>
								<Label htmlFor="light" className="text-sm">
									Light
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									value="dark"
									id="dark"
									checked={theme === "dark"}
									onChange={(e) => setTheme(e.target.value)}
									className="rounded"
								/>
								<Label htmlFor="dark" className="text-sm">
									Dark
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<input
									type="radio"
									value="system"
									id="system"
									checked={theme === "system"}
									onChange={(e) => setTheme(e.target.value)}
									className="rounded"
								/>
								<Label htmlFor="system" className="text-sm">
									System
								</Label>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Custom Theme</CardTitle>
						<CardDescription className="text-xs">
							Import and apply custom themes from Tweakcn.com
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<span className="font-medium text-xs">Status:</span>
								{tweakcnTheme ? (
									<Badge variant="default" className="bg-green-500 text-xs">
										Loaded ({tweakcnTheme.preset})
									</Badge>
								) : (
									<Badge variant="secondary" className="text-xs">
										No theme loaded
									</Badge>
								)}
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => window.open("https://tweakcn.com", "_blank")}
								className="h-7 px-2"
							>
								<ExternalLink className="mr-1 h-3 w-3" />
								<span className="text-xs">Visit</span>
							</Button>
						</div>

						<div className="space-y-2">
							<Label htmlFor="theme-url" className="text-xs">
								Theme URL (auto-applies)
							</Label>
							<Input
								id="theme-url"
								placeholder="https://tweakcn.com/r/themes/twitter.json"
								value={themeUrl}
								onChange={(e) => {
									setThemeUrl(e.target.value);
									setIsUserAction(true); // Mark as user action
								}}
								className="text-xs"
							/>
							{isLoading && (
								<p className="text-muted-foreground text-xs">
									Loading theme...
								</p>
							)}
						</div>

						<Button
							onClick={handleResetTheme}
							variant="outline"
							size="sm"
							disabled={!isTweakcnActive}
							className="h-8 w-full"
						>
							<RotateCcw className="mr-2 h-3 w-3" />
							<span className="text-xs">Reset to Default</span>
						</Button>

						{isTweakcnActive && (
							<div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
								<p className="text-green-600 text-xs dark:text-green-400">
									Custom Tweakcn theme is currently active
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
