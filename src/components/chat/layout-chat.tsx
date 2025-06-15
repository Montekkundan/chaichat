"use client";

import { useSidebar } from "~/components/ui/sidebar";

export function LayoutChat({ children }: { children: React.ReactNode }) {
	const { state } = useSidebar();
	const collapsed = state === "collapsed";

	return (
		<div className="absolute top-0 bottom-0 w-full">
			<div className="fixed top-0 right-0 max-sm:hidden">
				<div
					className={`group -mb-8 pointer-events-none absolute top-3.5 z-10 h-32 w-full origin-top transition-all ease-snappy${collapsed ? " -translate-y-3.5 scale-y-0" : ""}`}
					style={{ boxShadow: "10px -10px 8px 2px var(--gradient-noise-top)" }}
				>
					<svg
						className="-right-8 absolute h-9 origin-top-left skew-x-[30deg] overflow-visible"
						viewBox="0 0 128 32"
						aria-hidden="true"
						role="presentation"
					>
						<line
							stroke="var(--gradient-noise-top)"
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
							fill="var(--gradient-noise-top)"
							shapeRendering="optimizeQuality"
							strokeWidth={1}
							strokeLinecap="round"
							vectorEffect="non-scaling-stroke"
							d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0"
							stroke="hsl(var(--chat-border))"
						/>
					</svg>
				</div>
			</div>
			{children}
		</div>
	);
}
