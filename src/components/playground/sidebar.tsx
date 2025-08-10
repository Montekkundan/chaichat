import { PlusIcon, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	// SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { db } from "~/db";

function getPlaygroundListWithMeta(): Array<{
	id: string;
	name: string;
	createdAt: number;
}> {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem("chaichat_playground_list") || "[]";
		const ids: string[] = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
		const validIds = ids.filter((id) => id && id !== "playground-initial");
		return validIds.map((id: string) => {
			const raw = localStorage.getItem(`chaichat_playground_${id}`);
			if (!raw) return { id, name: id, createdAt: 0 };
			try {
				const parsed = JSON.parse(raw);
				return {
					id,
					name: parsed.name || id,
					createdAt: parsed.createdAt || 0,
				};
			} catch {
				return { id, name: id, createdAt: 0 };
			}
		});
	} catch {
		return [];
	}
}

// Helper to get playground summary (first column's model, message count, etc)
function getPlaygroundSummary(
	playgroundId: string,
): { model: string; messageCount: number } | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(`chaichat_playground_${playgroundId}`);
		const parsed = raw ? JSON.parse(raw) : {};
		const firstCol = parsed.columns?.[0];
		return {
			model: firstCol?.modelId || "-",
			// Prefer Dexie messages count if available
			messageCount: firstCol?.messages?.length || 0,
		};
	} catch {
		return null;
	}
}
export function AppSidebar({
	collapsed,
	...props
}: React.ComponentProps<typeof Sidebar> & { collapsed?: boolean }) {
	const [playgroundList, setPlaygroundList] = useState<
		Array<{ id: string; name: string; createdAt: number }>
	>([]);
	const [summaries, setSummaries] = useState<
		Record<string, { model: string; messageCount: number }>
	>({});
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [playgroundToDelete, setPlaygroundToDelete] = useState<string | null>(
		null,
	);
	const router = useRouter();

	const refreshList = useCallback(() => {
		const list = getPlaygroundListWithMeta();
		setPlaygroundList(list);
		const summaryObj: Record<string, { model: string; messageCount: number }> =
			{};
		for (const { id } of list) {
			const summary = getPlaygroundSummary(id);
			if (summary) summaryObj[id] = summary;
		}
		setSummaries(summaryObj);
	}, []);

	useEffect(() => {
		// React to cross-tab changes to localStorage for playground list
		const onStorage = (e: StorageEvent) => {
			if (
				e.key === "chaichat_playground_list" ||
				e.key?.startsWith("chaichat_playground_")
			) {
				refreshList();
			}
		};
		window.addEventListener("storage", onStorage);
		// Load from cookie snapshot if available (fast SSR hydration)
		try {
			const group = document.cookie.match(/cc_playgrounds=([^;]+)/)?.[1];
			if (group) {
				const parsed = JSON.parse(decodeURIComponent(group)) as Array<{
					id: string;
					name: string;
					createdAt: number;
				}>;
				if (Array.isArray(parsed) && parsed.length > 0) {
					setPlaygroundList(parsed);
				}
			}
		} catch {}

		// Load from localStorage (authoritative client index)
		refreshList();

		// Optional reconcile with cache-provider for authenticated users in future
		return () => window.removeEventListener("storage", onStorage);
	}, [refreshList]);

	function formatDate(ts: number) {
		if (!ts) return "(no time)";
		const d = new Date(ts);
		return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	function handleNewPlayground() {
		router.push("/playground");
	}

	function handleDeleteClick(id: string) {
		setPlaygroundToDelete(id);
		setDeleteDialogOpen(true);
	}

	function handleCancelDelete() {
		setDeleteDialogOpen(false);
		setPlaygroundToDelete(null);
	}

	async function handleConfirmDelete() {
		if (!playgroundToDelete) return;
		// Remove from localStorage
		localStorage.removeItem(`chaichat_playground_${playgroundToDelete}`);
		// Remove from list
		let list = [];
		try {
			list = JSON.parse(
				localStorage.getItem("chaichat_playground_list") || "[]",
			);
		} catch {}
		list = list.filter((pid: string) => pid !== playgroundToDelete);
		localStorage.setItem("chaichat_playground_list", JSON.stringify(list));
		// Remove from Dexie (playgrounds table and all related playgroundMessages)
		try {
			await Promise.all([
				db.playgrounds.delete(playgroundToDelete),
				db.playgroundMessages
					.where("playgroundId")
					.equals(playgroundToDelete)
					.delete(),
			]);
		} catch {}

		try {
			if (
				typeof window !== "undefined" &&
				window.location.pathname.includes(`/playground/${playgroundToDelete}`)
			) {
				router.replace("/playground");
			}
		} catch {}

		// Refresh cookie snapshot to keep SSR hydration fast and consistent
		try {
			const minimal = list.map((id: string) => {
				try {
					const raw = localStorage.getItem(`chaichat_playground_${id}`);
					const parsed = raw ? JSON.parse(raw) : {};
					return {
						id,
						name: parsed.name || id,
						createdAt: parsed.createdAt || Date.now(),
					};
				} catch {
					return { id, name: id, createdAt: Date.now() };
				}
			});
			const value = encodeURIComponent(JSON.stringify(minimal.slice(0, 20)));
			document.cookie = `cc_playgrounds=${value}; path=/; max-age=604800; SameSite=Lax`;
		} catch {}
		setDeleteDialogOpen(false);
		setPlaygroundToDelete(null);
		refreshList();
	}

	return (
		<Sidebar
			className={`${collapsed ? "left-14" : "left-64"} z-20 h-2/3 pt-16`}
			variant="floating"
			{...props}
		>
			<SidebarHeader>
				<SidebarMenu>
					{/* New Playground Button */}
					<SidebarMenuItem>
						<SidebarMenuButton size="sm" onClick={handleNewPlayground}>
							<PlusIcon className="h-4 w-4" />
							New Playground
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{/* Playground History Section */}
				<SidebarGroup>
					<div className="px-1 pt-2 pb-1 font-semibold text-muted-foreground text-xs">
						Playground History
					</div>
					<SidebarMenu className="gap-1">
						{playgroundList.length === 0 && (
							<SidebarMenuItem>
								<SidebarMenuButton disabled>
									No playgrounds yet
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
						{playgroundList.map(({ id, name, createdAt }) => (
							<SidebarMenuItem key={id} className="group relative">
								<SidebarMenuButton asChild>
									<Link
										href={`/playground/${id}`}
										className="flex w-full flex-col items-start pr-8"
									>
										<span className="font-medium text-xs">
											{name.startsWith("playground-")
												? `Playground (${formatDate(createdAt)})`
												: name}
										</span>
										<span className="font-mono text-[10px] text-muted-foreground">
											{id}
										</span>
										<span className="text-muted-foreground text-xs">
											Model: {summaries[id]?.model || "-"} | Messages:{" "}
											{summaries[id]?.messageCount ?? 0}
										</span>
									</Link>
								</SidebarMenuButton>
								{/* Delete button (show on hover) */}
								<button
									type="button"
									className="-translate-y-1/2 absolute top-1/2 right-2 hidden items-center justify-center text-muted-foreground hover:text-destructive group-hover:flex"
									style={{ background: "none", border: "none", padding: 0 }}
									onClick={(e) => {
										e.preventDefault();
										handleDeleteClick(id);
									}}
									aria-label="Delete playground"
								>
									<X className="h-3 w-3" />
								</button>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>
			{/* Playground Delete Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Playground</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this playground? This action
							cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={handleCancelDelete}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleConfirmDelete}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Sidebar>
	);
}
