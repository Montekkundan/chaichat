// Helper function to load Google Fonts
function loadGoogleFont(fontFamily: string, weights: string[] = ["400"]) {
	if (typeof window === "undefined") return;

	const encodedFamily = encodeURIComponent(fontFamily);
	const weightsParam = weights.join(";");
	const href = `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weightsParam}&display=swap`;

	const existing = document.querySelector(`link[href="${href}"]`);
	if (existing) {
		document.fonts.ready.then(() => {
			document.fonts.load(`400 16px "${fontFamily}"`).catch(() => {});
		});
		return;
	}

	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = href;

	link.onload = () => {
		document.fonts.ready.then(() => {
			document.fonts
				.load(`400 16px "${fontFamily}"`)
				.then(() => {
					document.body.style.fontFamily = document.body.style.fontFamily || "";
				})
				.catch(() => {});
		});
	};

	document.head.appendChild(link);
}

function extractFontFamily(fontFamilyValue: string): string | null {
	if (!fontFamilyValue) return null;
	const firstFont = fontFamilyValue.split(",")[0]?.trim();
	if (!firstFont) return null;
	const cleanFont = firstFont.replace(/['"]/g, "");
	const systemFonts = [
		"ui-sans-serif",
		"ui-serif",
		"ui-monospace",
		"system-ui",
		"sans-serif",
		"serif",
		"monospace",
		"cursive",
		"fantasy",
	];
	if (systemFonts.includes(cleanFont.toLowerCase())) {
		return null;
	}
	return cleanFont;
}

export interface TweakcnThemeState {
	styles: {
		light: TweakcnStyles;
		dark: TweakcnStyles;
	};
	currentMode: "light" | "dark";
	preset: string;
}

export interface TweakcnStyles {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	destructiveForeground: string;
	border: string;
	input: string;
	ring: string;
	chart1: string;
	chart2: string;
	chart3: string;
	chart4: string;
	chart5: string;
	sidebar: string;
	sidebarForeground: string;
	sidebarPrimary: string;
	sidebarPrimaryForeground: string;
	sidebarAccent: string;
	sidebarAccentForeground: string;
	sidebarBorder: string;
	sidebarRing: string;
	"font-sans": string;
	"font-serif": string;
	"font-mono": string;
	radius: string;
	shadowColor: string;
	shadowOpacity: string;
	shadowBlur: string;
	shadowSpread: string;
	shadowOffsetX: string;
	shadowOffsetY: string;
	letterSpacing: string;
	spacing: string;
}

function applyStyleToElement(element: HTMLElement, key: string, value: string) {
	const currentStyle = element.getAttribute("style") || "";
	const cleanedStyle = currentStyle
		.replace(new RegExp(`--${key}:\\s*[^;]+;?`, "g"), "")
		.trim();

	element.setAttribute("style", `${cleanedStyle}--${key}: ${value};`);
}

function updateThemeClass(root: HTMLElement, mode: "light" | "dark") {
	if (mode === "light") {
		root.classList.remove("dark");
	} else {
		root.classList.add("dark");
	}
}

let isResetting = false;
let lastAppliedTime = 0;
let lastThemeState: TweakcnThemeState | null = null;
const APPLY_THROTTLE_MS = 1000;

export function applyTweakcnTheme(
	themeState: TweakcnThemeState,
	bypassThrottle = false,
) {
	if (typeof window === "undefined") return;

	if (isResetting) return;

	const now = Date.now();

	const isModeChangeOnly =
		lastThemeState &&
		lastThemeState.preset === themeState.preset &&
		lastThemeState.currentMode !== themeState.currentMode &&
		JSON.stringify(lastThemeState.styles) === JSON.stringify(themeState.styles);

	if (
		!bypassThrottle &&
		!isModeChangeOnly &&
		now - lastAppliedTime < APPLY_THROTTLE_MS
	)
		return;

	lastAppliedTime = now;
	lastThemeState = { ...themeState };

	const root = document.documentElement;
	const { currentMode: mode, styles: themeStyles } = themeState;

	if (!root) return;

	const currentStyles = themeStyles[mode];
	for (const [key, value] of Object.entries(currentStyles)) {
		if (typeof value === "string") {
			applyStyleToElement(root, key, value);
		}
	}

	if (!isModeChangeOnly) {
		try {
			if (currentStyles) {
				const currentFonts = {
					sans: currentStyles["font-sans"],
					serif: currentStyles["font-serif"],
					mono: currentStyles["font-mono"],
				};

				const fontPromises: Promise<void>[] = [];

				for (const [type, fontValue] of Object.entries(currentFonts)) {
					if (fontValue) {
						const fontFamily = extractFontFamily(fontValue);
						if (fontFamily) {
							loadGoogleFont(fontFamily);

							fontPromises.push(
								document.fonts.ready
									.then(() => {
										return document.fonts.load(`400 16px "${fontFamily}"`);
									})
									.then(() => {
										// Font loaded successfully
									})
									.catch(() => {
										// Silently handle font loading errors
									}),
							);
						}
					}
				}

				Promise.all(fontPromises).then(() => {
					setTimeout(() => {
						const fontSansValue = currentStyles["font-sans"];
						const fontSerifValue = currentStyles["font-serif"];
						const fontMonoValue = currentStyles["font-mono"];

						if (fontSansValue) {
							root.style.setProperty("--font-sans", "inherit");
							setTimeout(
								() => root.style.setProperty("--font-sans", fontSansValue),
								10,
							);
						}
						if (fontSerifValue) {
							root.style.setProperty("--font-serif", "inherit");
							setTimeout(
								() => root.style.setProperty("--font-serif", fontSerifValue),
								10,
							);
						}
						if (fontMonoValue) {
							root.style.setProperty("--font-mono", "inherit");
							setTimeout(
								() => root.style.setProperty("--font-mono", fontMonoValue),
								10,
							);
						}
					}, 100);
				});
			}
		} catch (e) {
			// Silently handle font loading errors
		}
	}

	localStorage.setItem("chai-tweakcn-theme", JSON.stringify(themeState));
}

export function getStoredTweakcnTheme(): TweakcnThemeState | null {
	if (typeof window === "undefined") return null;

	try {
		const stored = localStorage.getItem("chai-tweakcn-theme");
		if (!stored) return null;

		return JSON.parse(stored);
	} catch (error) {
		console.error("Failed to parse stored Tweakcn theme:", error);
		return null;
	}
}

const THEME_RESET_EVENT = "tweakcn-theme-reset";

export const TWEAKCN_THEME_RESET_EVENT = THEME_RESET_EVENT;

export function resetToDefaultTheme() {
	if (typeof window === "undefined") return;

	isResetting = true;

	const root = document.documentElement;

	localStorage.removeItem("chai-tweakcn-theme");
	localStorage.removeItem("chai-tweakcn-theme-url");
	root.removeAttribute("style");

	window.dispatchEvent(new CustomEvent(THEME_RESET_EVENT));

	setTimeout(() => {
		if (localStorage.getItem("chai-tweakcn-theme")) {
			localStorage.removeItem("chai-tweakcn-theme");
		}
		if (localStorage.getItem("chai-tweakcn-theme-url")) {
			localStorage.removeItem("chai-tweakcn-theme-url");
		}
		isResetting = false;
	}, 500);

	try {
		const nextThemesTheme = localStorage.getItem("theme");
		if (nextThemesTheme) {
			if (nextThemesTheme === "dark") {
				root.classList.add("dark");
			} else if (nextThemesTheme === "light") {
				root.classList.remove("dark");
			} else if (nextThemesTheme === "system") {
				const prefersDark = window.matchMedia(
					"(prefers-color-scheme: dark)",
				).matches;
				if (prefersDark) {
					root.classList.add("dark");
				} else {
					root.classList.remove("dark");
				}
			}
		}
	} catch (e) {
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		if (prefersDark) {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}
	}
}

export async function fetchTweakcnTheme(
	url: string,
): Promise<TweakcnThemeState | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch theme: ${response.status}`);
		}
		const themeData = await response.json();
		return {
			styles: {
				light: themeData.cssVars.light as unknown as TweakcnStyles,
				dark: themeData.cssVars.dark as unknown as TweakcnStyles,
			},
			currentMode: "light",
			preset: themeData.name,
		};
	} catch (error) {
		console.error("Failed to fetch Tweakcn theme:", error);
		return null;
	}
}

export function parseCSSToTheme(cssText: string): TweakcnThemeState | null {
	try {
		const lightVars: Record<string, string> = {};
		const darkVars: Record<string, string> = {};
		const cssLines = cssText.split("\n");
		let currentMode: "light" | "dark" | "root" = "root";

		for (const line of cssLines) {
			const trimmedLine = line.trim();
			if (trimmedLine === ".dark {") {
				currentMode = "dark";
				continue;
			}
			if (trimmedLine === ":root {") {
				currentMode = "root";
				continue;
			}
			if (trimmedLine === "}") {
				currentMode = "root";
				continue;
			}
			const varMatch = trimmedLine.match(/--([^:]+):\s*([^;]+);/);
			if (varMatch) {
				const varName = varMatch[1];
				const varValue = varMatch[2];
				if (varName && varValue) {
					const cleanValue = varValue.trim();
					if (currentMode === "dark") {
						darkVars[varName] = cleanValue;
					} else {
						lightVars[varName] = cleanValue;
					}
				}
			}
		}

		const nameMatch = cssText.match(/\/\*\s*Theme:\s*([^*]+)\s*\*\//);
		const themeName = nameMatch?.[1]?.trim() || "Custom Theme";

		return {
			styles: {
				light: lightVars as unknown as TweakcnStyles,
				dark: darkVars as unknown as TweakcnStyles,
			},
			currentMode: "light",
			preset: themeName,
		};
	} catch (error) {
		console.error("Failed to parse CSS theme:", error);
		return null;
	}
}

export function isTweakcnThemeActive(): boolean {
	if (typeof window === "undefined") return false;
	return localStorage.getItem("chai-tweakcn-theme") !== null;
}

export function restoreTweakcnTheme() {
	if (typeof window === "undefined") return;

	const storedTheme = getStoredTweakcnTheme();
	if (storedTheme) {
		applyTweakcnTheme(storedTheme);
	}
}
