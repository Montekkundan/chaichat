export const baseColors = [
	{
		name: "default",
		label: "Default",
		activeColor: {
			light: "oklch(0.205 0 0)",
			dark: "oklch(0.922 0 0)",
		},
	},
	{
		name: "t3chat",
		label: "T3 Chat",
		activeColor: {
			light: "oklch(0.5316 0.1409 355.1999)",
			dark: "oklch(0.4607 0.1853 4.0994)",
		},
	},
	{
		name: "vercel",
		label: "Vercel",
		activeColor: {
			light: "oklch(0 0 0)",
			dark: "oklch(1 0 0)",
		},
	},
] as const;

export type BaseColor = (typeof baseColors)[number]; 