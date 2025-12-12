import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, generateOGImageURL } from "~/lib/config";
import { readAllRegistryItems } from "~/lib/registry";
import { LayoutMain } from "~/components/chat/layout-chat";
import { cn } from "~/lib/utils";

export const metadata: Metadata = {
	title: `Registry - ${APP_NAME}`,
	description:
		"Custom component registry for distributing code using shadcn. Browse and explore reusable components.",
	openGraph: {
		title: `Registry - ${APP_NAME}`,
		description:
			"Custom component registry for distributing code using shadcn. Browse and explore reusable components.",
		images: [
			{
				url: generateOGImageURL({
					title: "Registry",
					type: "registry",
				}),
				width: 1200,
				height: 630,
				alt: "Registry - ChaiChat",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `Registry - ${APP_NAME}`,
		description:
			"Custom component registry for distributing code using shadcn. Browse and explore reusable components.",
		images: [
			generateOGImageURL({
				title: "Registry",
				type: "registry",
			}),
		],
	},
};

export default async function RegistryLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const all = await readAllRegistryItems();
	const hasBlocks = all.some((i) => i.type?.includes("block"));
	const hasComponents = all.some((i) => i.type?.includes("component") || i.type?.includes("ui"));
	const hasPages = all.some((i) => i.type?.includes("page"));
	return (
		<LayoutMain>
			<div className="relative h-full overflow-y-auto">
				<div className="mx-auto max-w-7xl px-4 py-6">
				<header className="mb-6 flex flex-col gap-2">
					<h1 className="font-bold text-3xl tracking-tight">Registry</h1>
					<p className="text-muted-foreground">
						Distributing blocks, components, and pages which I created for experimenting with AI.
					</p>
					<nav className="mt-2 flex flex-wrap items-center gap-2">
						{hasBlocks ? (
							<RegistryNavLink href="/registry/blocks">Blocks</RegistryNavLink>
						) : null}
						{hasComponents ? (
							<RegistryNavLink href="/registry/components">Components</RegistryNavLink>
						) : null}
						{hasPages ? (
							<RegistryNavLink href="/registry/pages">Pages</RegistryNavLink>
						) : null}
					</nav>
				</header>
				{children}
				</div>
			</div>
		</LayoutMain>
	);
}

function RegistryNavLink({
	href,
	children,
}: {
	href: string;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			className={cn(
				"rounded-md border px-3 py-1.5 text-sm hover:bg-accent",
				"border-border text-foreground",
			)}
		>
			{children}
		</Link>
	);
}
