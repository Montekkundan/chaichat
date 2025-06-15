"use client";

import { CheckIcon, MoonIcon, RepeatIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useThemeConfig } from "~/components/active-theme";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { baseColors } from "~/lib/colors";
import { cn } from "~/lib/utils";

export function ThemeSelector() {
	const { activeTheme, setActiveTheme } = useThemeConfig();
	const saveThemePref = useMutation(api.userPreferences.setTheme);
	const [mounted, setMounted] = useState(false);
	const { setTheme, resolvedTheme: theme } = useTheme();

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<div className="w-full">
			<div className="flex items-start pt-4 md:pt-0">
				<div className="space-y-1 pr-2">
					<div className="font-semibold leading-none tracking-tight">
						Customize
					</div>
					<div className="text-muted-foreground text-xs">
						Pick a style and color for the interface.
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					className="ml-auto rounded-[0.5rem]"
					onClick={() => {
						setTheme("system");
						setActiveTheme("default");
					}}
				>
					<RepeatIcon className="size-4" />
					<span className="sr-only">Reset</span>
				</Button>
			</div>

			<div className="flex flex-col space-y-6">
				<div className="space-y-1.5">
					<p className="font-medium text-xs">Color</p>
					<div className="flex flex-col gap-2">
						{baseColors.map((color) => {
							const isActive = activeTheme === color.name;
							return mounted ? (
								<Button
									variant="outline"
									size="sm"
									key={color.name}
									onClick={() => {
										setActiveTheme(color.name);
										saveThemePref({ theme: color.name }).catch(() => {});
									}}
									className={cn(
										"justify-start",
										isActive && "border-2 border-primary dark:border-primary",
									)}
									style={
										{
											"--theme-primary":
												color.activeColor[theme === "dark" ? "dark" : "light"],
										} as React.CSSProperties
									}
								>
									<span
										className={cn(
											"-translate-x-1 mr-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary)]",
										)}
									>
										{isActive && <CheckIcon className="size-4 text-white" />}
									</span>
									{color.label}
								</Button>
							) : (
								<Skeleton key={color.name} className="h-8 w-full" />
							);
						})}
					</div>
				</div>

				<div className="space-y-1.5">
					<p className="font-medium text-xs">Mode</p>
					<div className="grid grid-cols-3 gap-2">
						{mounted ? (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setTheme("light")}
									className={cn(theme !== "dark" && "border-2 border-primary")}
								>
									<SunIcon className="-translate-x-1 mr-1 size-4" /> Light
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setTheme("dark")}
									className={cn(
										theme === "dark" &&
											"border-2 border-primary dark:border-primary",
									)}
								>
									<MoonIcon className="-translate-x-1 mr-1 size-4" /> Dark
								</Button>
							</>
						) : (
							<>
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-full" />
							</>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
