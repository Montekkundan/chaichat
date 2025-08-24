import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, generateOGImageURL } from "~/lib/config";
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

export default function RegistryLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<LayoutMain>
			<div className="mx-auto max-w-7xl px-4 py-6">
				<header className="mb-6 flex flex-col gap-2">
					<h1 className="font-bold text-3xl tracking-tight">Registry</h1>
					<p className="text-muted-foreground">
						Distribute reusable code with a docs-like experience.
					</p>
					<nav className="mt-2 flex flex-wrap items-center gap-2">
						<RegistryNavLink href="/registry/blocks">Blocks</RegistryNavLink>
						<RegistryNavLink href="/registry/components">Components</RegistryNavLink>
						<RegistryNavLink href="/registry/pages">Pages</RegistryNavLink>
					</nav>
				</header>
				{children}
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
