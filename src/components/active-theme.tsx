"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_APP_THEME } from "~/lib/config";

const COOKIE_NAME = "active_theme";
const DEFAULT_THEME = DEFAULT_APP_THEME;

function setThemeCookie(theme: string) {
	if (typeof document === "undefined") return;
	document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === "https:" ? "Secure;" : ""}`;
}

type ThemeContextType = {
	activeTheme: string;
	setActiveTheme: (theme: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ActiveThemeProvider({
	children,
	initialTheme,
}: {
	children: ReactNode;
	initialTheme?: string;
}) {
	const [activeTheme, setActiveTheme] = useState(
		() => initialTheme || DEFAULT_THEME,
	);

	useEffect(() => {
		setThemeCookie(activeTheme);
		// remove any existing theme-* classes
		for (const className of Array.from(document.body.classList)) {
			if (className.startsWith("theme-")) {
				document.body.classList.remove(className);
			}
		}

		document.body.classList.add(`theme-${activeTheme}`);
		if (activeTheme.endsWith("-scaled")) {
			document.body.classList.add("theme-scaled");
		} else {
			document.body.classList.remove("theme-scaled");
		}
	}, [activeTheme]);

	return (
		<ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useThemeConfig() {
	const ctx = useContext(ThemeContext);
	if (!ctx)
		throw new Error(
			"useThemeConfig must be used within an ActiveThemeProvider",
		);
	return ctx;
}
