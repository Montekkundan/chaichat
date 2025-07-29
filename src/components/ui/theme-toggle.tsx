"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { useTheme } from "next-themes";
import { SunDimIcon, MoonIcon } from "@phosphor-icons/react";

import { cn } from "~/lib/utils";

const toggleVariants = cva(
	"inline-flex items-center justify-center rounded-md font-medium text-sm ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-accent-foreground",
	{
		variants: {
			variant: {
				default: "bg-transparent",
				outline:
					"border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
			},
			size: {
				default: "h-10 px-3",
				sm: "h-9 px-2.5",
				lg: "h-11 px-5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "sm",
		},
	},
);

const Toggle = React.forwardRef<
	React.ElementRef<typeof TogglePrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
		VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
	<TogglePrimitive.Root
		ref={ref}
		className={cn(toggleVariants({ variant, size, className }))}
		{...props}
	/>
));

Toggle.displayName = TogglePrimitive.Root.displayName;

const ThemeToggle = React.forwardRef<
	React.ElementRef<typeof TogglePrimitive.Root>,
	Omit<React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>, "pressed" | "onPressedChange"> &
		VariantProps<typeof toggleVariants> & {
			iconSize?: number;
		}
>(({ className, variant, size, iconSize = 16, ...props }, ref) => {
	const { theme, setTheme } = useTheme();

	const handleToggle = () => {
		if (theme === "dark") {
			setTheme("light");
		} else {
			setTheme("dark");
		}
	};

	return (
		<TogglePrimitive.Root
			ref={ref}
			onPressedChange={handleToggle}
			className={cn(toggleVariants({ variant, size, className }), "relative")}
			{...props}
		>
			<SunDimIcon 
				size={iconSize} 
				className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" 
			/>
			<MoonIcon 
				size={iconSize} 
				className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" 
			/>
			<span className="sr-only">Toggle theme</span>
		</TogglePrimitive.Root>
	);
});

ThemeToggle.displayName = "ThemeToggle";

export { Toggle, ThemeToggle, toggleVariants };
