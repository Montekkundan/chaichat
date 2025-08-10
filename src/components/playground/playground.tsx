"use client";

import { PlaygroundColumn } from "./playground-column";
import { usePlayground } from "~/lib/providers/playground-provider";
import { AppSidebar } from "./sidebar";
import { SidebarProvider, SidebarTrigger, useSidebar } from "../ui/sidebar";

export function Playground() {
    const { columns } = usePlayground();

	const { state } = useSidebar();
	const collapsed = state === "collapsed";

		return (
            <SidebarProvider toggleSidebarShortcut={false} defaultOpen={false}>
                <div className="flex flex-col size-full h-screen min-h-0">
					<AppSidebar collapsed={collapsed} />
					<div className={`${collapsed ? "p-4" : "pb-0 pt-6 pl-3"} flex items-center justify-between z-21`}>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-semibold">Playground</h1>
						<SidebarTrigger />
					</div>

				</div>

                {/* Columns Container */}
                <div className="flex flex-1 min-h-0 p-2 space-x-2 overflow-x-auto snap-x snap-mandatory lg:snap-none">
					{columns.map((column, index) => (
						<div
							key={column.id}
							id={`chats-index-${index}`}
                            className="@container size-full min-h-0 shrink-0 rounded-md bg-background-100 snap-center lg:shrink lg:min-w-96"
							tabIndex={-1}
						>
							<PlaygroundColumn
								column={column}
								columnIndex={index}
							/>
						</div>
					))}
				</div>
			</div>
		</SidebarProvider>
	);
}
