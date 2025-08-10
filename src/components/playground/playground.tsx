"use client";

import { usePlayground } from "~/lib/providers/playground-provider";
import { SidebarProvider, SidebarTrigger, useSidebar } from "../ui/sidebar";
import { PlaygroundColumn } from "./playground-column";
import { AppSidebar } from "./sidebar";

export function Playground() {
	const { columns } = usePlayground();

	const { state } = useSidebar();
	const collapsed = state === "collapsed";

	return (
		<SidebarProvider toggleSidebarShortcut={false} defaultOpen={false}>
			<div className="flex size-full h-screen min-h-0 flex-col">
				<AppSidebar collapsed={collapsed} />
				<div
					className={`${collapsed ? "p-4" : "pt-6 pb-0 pl-3"} z-21 flex items-center justify-between`}
				>
					<div className="flex items-center gap-3">
						<h1 className="font-semibold text-2xl">Playground</h1>
						<SidebarTrigger />
					</div>
				</div>

				{/* Columns Container */}
				<div className="flex min-h-0 flex-1 snap-x snap-mandatory space-x-2 overflow-x-auto p-2 lg:snap-none">
					{columns.map((column, index) => (
						<div
							key={column.id}
							id={`chats-index-${index}`}
							className="@container size-full min-h-0 shrink-0 snap-center rounded-md bg-background-100 lg:min-w-96 lg:shrink"
							tabIndex={-1}
						>
							<PlaygroundColumn column={column} columnIndex={index} />
						</div>
					))}
				</div>
			</div>
		</SidebarProvider>
	);
}
