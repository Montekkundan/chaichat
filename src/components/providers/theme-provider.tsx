"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";
import { useEffect } from "react";
import { applyTweakcnTheme, getStoredTweakcnTheme } from "~/lib/tweakcn-theme";

export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	// Sync tweakcn theme with next-themes on mount and theme changes
	useEffect(() => {
		let timeoutId: NodeJS.Timeout;

		const syncTweakcnTheme = () => {
			const storedTheme = getStoredTweakcnTheme();
			if (storedTheme) {
				// Check current DOM state for dark mode
				const isDarkMode = document.documentElement.classList.contains("dark");
				const newMode = isDarkMode ? "dark" : "light";

				// Only update if the mode actually changed
				if (storedTheme.currentMode !== newMode) {
					const syncedTheme = {
						...storedTheme,
						currentMode: newMode as "dark" | "light",
					};
					// Use bypassThrottle for instant mode changes
					applyTweakcnTheme(syncedTheme, true);
				}
			}
		};

		// Initial sync after next-themes has initialized
		timeoutId = setTimeout(syncTweakcnTheme, 100);

		// Listen for class changes on the html element (next-themes updates)
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "class"
				) {
					// Debounce the sync to avoid rapid-fire updates
					clearTimeout(timeoutId);
					timeoutId = setTimeout(syncTweakcnTheme, 50);
				}
			}
		});

		// Observe class changes on html element
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			clearTimeout(timeoutId);
			observer.disconnect();
		};
	}, []);

	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
