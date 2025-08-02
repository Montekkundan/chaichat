"use client";

import { useState } from "react";
import { Gear } from "@phosphor-icons/react";
import { SettingsDialog } from "~/components/settings-dialog";
import  ThemeToggle from "~/components/ui/theme-toggle";
import { useSidebar } from "~/components/ui/sidebar";

export function LayoutChat({ children }: { children: React.ReactNode }) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<div className="absolute top-0 bottom-0 w-full">
			<div className="fixed top-0 right-0 max-sm:hidden">
				<div
					className={`group -mb-8 pointer-events-none absolute top-3.5 z-10 h-32 w-full origin-top transition-all ease-snappy${collapsed ? " -translate-y-3.5 scale-y-0" : ""}`}
					style={{ boxShadow: "10px -10px 8px 2px var(--sidebar)" }}
				>
					<svg
						className="-right-8 absolute h-9 origin-top-left skew-x-[30deg] overflow-visible"
						viewBox="0 0 128 32"
						aria-hidden="true"
						role="presentation"
					>
						<line
							stroke="var(--sidebar)"
							strokeWidth={2}
							shapeRendering="optimizeQuality"
							vectorEffect="non-scaling-stroke"
							strokeLinecap="round"
							x1={1}
							y1={0}
							x2={128}
							y2={0}
						/>
						<path
							className="translate-y-[0.5px]"
							fill="var(--sidebar)"
							shapeRendering="optimizeQuality"
							strokeWidth={1}
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
							d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0"
							stroke="var(--border)"
						/>
					</svg>
				</div>
			</div>
			
			{/* Settings and Theme Toggle Bar */}
			<div className="fixed top-2 right-2 z-50 max-sm:hidden">
				<div className="flex flex-row items-center gap-0.5 rounded-md rounded-bl-xl bg-sidebar p-1 text-muted-foreground transition-all">
					<button
						type="button"
						aria-label="Open settings"
						onClick={() => setSettingsOpen(true)}
						className="inline-flex size-8 items-center justify-center rounded-md rounded-bl-xl hover:bg-muted/40 hover:text-foreground"
						data-discover="true"
					>
						<Gear className="size-4" />
					</button>
					<ThemeToggle />
				</div>
			</div>
			
			{children}
			
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
		</div>
	);
}
