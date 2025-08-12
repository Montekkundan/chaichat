/**
 * Tweakcn Theme Utilities
 *
 * This module provides utilities for fetching, applying, and managing Tweakcn themes.
 * Tweakcn is a service that provides custom CSS themes for UI components.
 *
 * @see https://tweakcn.com
 */

export const TWEAKCN_THEME_RESET_EVENT = "tweakcn-theme-reset";

export interface TweakcnThemeState {
	preset: string;
	currentMode: "dark" | "light";
	themes: {
		light: Record<string, string>;
		dark: Record<string, string>;
	};
	url?: string;
}

/**
 * Fetches a theme from Tweakcn URL
 */
export async function fetchTweakcnTheme(
	url: string,
): Promise<TweakcnThemeState | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();

		// Validate the theme structure - Tweakcn themes have cssVars instead of themes
		if (
			!data.name ||
			!data.cssVars ||
			!data.cssVars.light ||
			!data.cssVars.dark
		) {
			throw new Error("Invalid theme structure - missing required fields");
		}

		const theme: TweakcnThemeState = {
			preset: data.name,
			currentMode: "light",
			themes: {
				light: data.cssVars.light,
				dark: data.cssVars.dark,
			},
			url: url,
		};

		// Store the theme
		localStorage.setItem("tweakcn-theme", JSON.stringify(theme));

		return theme;
	} catch (error) {
		console.error("Error fetching theme:", error);
		return null;
	}
}

/**
 * Applies a Tweakcn theme to the document
 */
export function applyTweakcnTheme(
	theme: TweakcnThemeState,
	skipStorage = false,
): void {
	const root = document.documentElement;
	const themeVars = theme.themes[theme.currentMode];

	// Font properties that should be applied directly to the root element
	const fontProperties = ["font-sans", "font-serif", "font-mono"];

	// Apply CSS variables and handle special properties
	for (const [key, value] of Object.entries(themeVars)) {
		if (fontProperties.includes(key)) {
			// Apply font families directly to the root element
			switch (key) {
				case "font-sans":
					root.style.setProperty("--font-sans", value);
					// Also apply to body if it exists
					if (document.body) {
						document.body.style.fontFamily = value;
					}
					break;
				case "font-serif":
					root.style.setProperty("--font-serif", value);
					break;
				case "font-mono":
					root.style.setProperty("--font-mono", value);
					break;
			}
		} else {
			// Apply as CSS custom property
			root.style.setProperty(`--${key}`, value);
		}
	}

	// Apply additional font styling to ensure fonts are loaded
	const style = document.createElement("style");
	style.id = "tweakcn-theme-fonts";

	// Remove existing style if present
	const existingStyle = document.getElementById("tweakcn-theme-fonts");
	if (existingStyle) {
		existingStyle.remove();
	}

	// Create font CSS
	const fontSans = themeVars["font-sans"];
	const fontSerif = themeVars["font-serif"];
	const fontMono = themeVars["font-mono"];

	let fontCSS = "";
	if (fontSans) {
		fontCSS += `
			body, .font-sans {
				font-family: ${fontSans} !important;
			}
		`;
	}
	if (fontSerif) {
		fontCSS += `
			.font-serif {
				font-family: ${fontSerif} !important;
			}
		`;
	}
	if (fontMono) {
		fontCSS += `
			.font-mono, code, pre {
				font-family: ${fontMono} !important;
			}
		`;
	}

	style.textContent = fontCSS;
	document.head.appendChild(style);

	// Store the current state
	if (!skipStorage) {
		localStorage.setItem("tweakcn-theme", JSON.stringify(theme));
		localStorage.setItem("tweakcn-active", "true");
	}
}

/**
 * Gets the stored Tweakcn theme
 */
export function getStoredTweakcnTheme(): TweakcnThemeState | null {
	try {
		const stored = localStorage.getItem("tweakcn-theme");
		return stored ? JSON.parse(stored) : null;
	} catch {
		return null;
	}
}

/**
 * Checks if a Tweakcn theme is currently active
 */
export function isTweakcnThemeActive(): boolean {
	return localStorage.getItem("tweakcn-active") === "true";
}

/**
 * Resets to the default theme
 */
export function resetToDefaultTheme(): void {
	const root = document.documentElement;

	// Remove font style element if it exists
	const fontStyle = document.getElementById("tweakcn-theme-fonts");
	if (fontStyle) {
		fontStyle.remove();
	}

	// Reset body font family
	if (document.body) {
		document.body.style.removeProperty("font-family");
	}

	// Get all CSS custom properties that were set by Tweakcn
	const rootStyle = root.style;
	const propertiesToRemove: string[] = [];

	// Collect all CSS custom properties
	for (let i = 0; i < rootStyle.length; i++) {
		const property = rootStyle[i];
		if (property?.startsWith("--")) {
			propertiesToRemove.push(property);
		}
	}

	// Remove all collected properties
	for (const property of propertiesToRemove) {
		root.style.removeProperty(property);
	}

	// Also specifically remove common theme variables
	const commonVars = [
		"--background",
		"--foreground",
		"--card",
		"--card-foreground",
		"--popover",
		"--popover-foreground",
		"--primary",
		"--primary-foreground",
		"--secondary",
		"--secondary-foreground",
		"--muted",
		"--muted-foreground",
		"--accent",
		"--accent-foreground",
		"--destructive",
		"--destructive-foreground",
		"--border",
		"--input",
		"--ring",
		"--radius",
		"--font-sans",
		"--font-serif",
		"--font-mono",
		"--chart-1",
		"--chart-2",
		"--chart-3",
		"--chart-4",
		"--chart-5",
		"--sidebar",
		"--sidebar-foreground",
		"--sidebar-primary",
		"--sidebar-primary-foreground",
		"--sidebar-accent",
		"--sidebar-accent-foreground",
		"--sidebar-border",
		"--sidebar-ring",
		"--shadow-color",
		"--shadow-opacity",
		"--shadow-blur",
		"--shadow-spread",
		"--shadow-offset-x",
		"--shadow-offset-y",
		"--letter-spacing",
		"--spacing",
		"--shadow-2xs",
		"--shadow-xs",
		"--shadow-sm",
		"--shadow",
		"--shadow-md",
		"--shadow-lg",
		"--shadow-xl",
		"--shadow-2xl",
		"--tracking-normal",
		"--tracking-tighter",
		"--tracking-tight",
		"--tracking-wide",
		"--tracking-wider",
		"--tracking-widest",
	];

	// Force remove common variables
	for (const varName of commonVars) {
		root.style.removeProperty(varName);
	}

	// Force a reflow to ensure changes are applied
	root.offsetHeight;

	// Clear storage
	localStorage.removeItem("tweakcn-theme");
	localStorage.removeItem("tweakcn-active");

	// Dispatch reset event
	window.dispatchEvent(new CustomEvent(TWEAKCN_THEME_RESET_EVENT));

	// Force document refresh of computed styles
	if (document.body) {
		const originalDisplay = document.body.style.display;
		document.body.style.display = "none";
		document.body.offsetHeight; // Trigger reflow
		document.body.style.display = originalDisplay;
	}
}

/**
 * Initializes Tweakcn theme on app start
 */
export function initializeTweakcnTheme(): void {
	const storedTheme = getStoredTweakcnTheme();
	const isActive = isTweakcnThemeActive();

	if (storedTheme && isActive) {
		applyTweakcnTheme(storedTheme, true);
	}
}
