"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

export function DocsShell({
	title,
	sidebar,
	children,
	toc,
}: {
	title?: string;
	sidebar?: React.ReactNode;
	children: React.ReactNode;
	toc?: React.ReactNode;
}) {
	return (
		<div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)_220px]">
			<aside className="hidden lg:block">
				{sidebar}
			</aside>
			<section>
				{title ? (
					<div className="mb-6">
						<h2 className="font-bold text-2xl tracking-tight">{title}</h2>
					</div>
				) : null}
				{children}
			</section>
			<aside className="hidden lg:block">
				{toc}
			</aside>
		</div>
	);
}

export function DocsSidebar({
	items,
	title = "Blocks",
}: {
	items: Array<{ slug: string; title: string }>;
	title?: string;
}) {
	const pathname = usePathname();
	return (
		<div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
			<div className="mb-3 text-muted-foreground text-xs">{title}</div>
			<nav className="space-y-1">
				{items.map((item) => {
					const href = `/registry/blocks/${item.slug}`;
					const active = pathname?.startsWith(href);
					return (
						<Link
							key={item.slug}
							href={href}
							className={cn(
								"block rounded-md px-2 py-1.5 text-sm hover:bg-accent",
								active ? "bg-accent text-foreground" : "text-muted-foreground",
							)}
						>
							{item.title}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}

export function DocsTOC({
	headings,
}: {
	headings: { id: string; text: string; level: number }[];
}) {
	return (
		<div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pl-2">
			<div className="mb-3 text-muted-foreground text-xs">On this page</div>
			<nav className="space-y-1">
				{headings.map((h) => (
					<a
						key={h.id}
						href={`#${h.id}`}
						className={cn(
							"block truncate rounded-md px-2 py-1.5 text-xs hover:bg-accent",
							h.level === 1 && "font-medium",
							h.level === 2 && "pl-3",
							h.level === 3 && "pl-5",
						)}
					>
						{h.text}
					</a>
				))}
			</nav>
		</div>
	);
}


