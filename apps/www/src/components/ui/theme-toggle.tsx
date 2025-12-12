"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toggle } from "~/components/ui/toggle";

export default function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div>
				<Toggle
					className="group size-9 data-[state=on]:bg-transparent data-[state=on]:hover:bg-muted"
					pressed={false}
					aria-label="Loading theme toggle"
				>
					<Sun
						size={16}
						strokeWidth={2}
						className="shrink-0"
						aria-hidden="true"
					/>
				</Toggle>
			</div>
		);
	}

	return (
		<div>
			<Toggle
				className="group size-9 data-[state=on]:bg-transparent data-[state=on]:hover:bg-muted"
				pressed={theme === "dark"}
				onPressedChange={() => setTheme(theme === "dark" ? "light" : "dark")}
				aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
			>
				<Moon
					size={16}
					strokeWidth={2}
					className="shrink-0 scale-0 opacity-0 transition-all group-data-[state=on]:scale-100 group-data-[state=on]:opacity-100"
					aria-hidden="true"
				/>
				<Sun
					size={16}
					strokeWidth={2}
					className="absolute shrink-0 scale-100 opacity-100 transition-all group-data-[state=on]:scale-0 group-data-[state=on]:opacity-0"
					aria-hidden="true"
				/>
			</Toggle>
		</div>
	);
}
