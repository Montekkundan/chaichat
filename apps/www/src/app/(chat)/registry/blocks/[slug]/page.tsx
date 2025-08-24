import * as React from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocsShell, DocsSidebar, DocsTOC } from "~/components/registry/registry-layout";
import { InstallCommand } from "~/components/registry/install-command";
import { extractMarkdownHeadings, readAllRegistryItems, readRegistryItem } from "~/lib/registry";
import { BlockPreview } from "~/components/registry/block-preview";
import { OpenInV0Button } from "~/components/open-in-v0-button";

export async function generateStaticParams() {
	const items = await readAllRegistryItems();
	return items.map((i) => ({ slug: i.slug }));
}

export default async function BlockDetailPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const item = await readRegistryItem(slug);
	if (!item) return notFound();
	const all = await readAllRegistryItems();
	const sidebarItems = all.filter((i) => i.type?.includes("block"));
	const headings = extractMarkdownHeadings(item.docs);

	function slugify(text: string) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "")
			.trim()
			.replace(/\s+/g, "-");
	}

	return (
		<DocsShell
			title={item.title}
			sidebar={
				<DocsSidebar
					items={sidebarItems.map((i) => ({ slug: i.slug, title: i.title }))}
				/>
			}
			toc={<DocsTOC headings={headings} />}
		>
			<div className="space-y-6">
				<p className="text-muted-foreground">{item.description}</p>
				<div className="flex flex-wrap items-center gap-2">
					<OpenInV0Button name={slug} />
					<InstallCommand slug={slug} />
				</div>
				<BlockPreview slug={slug} />
				{item.docs ? (
					<div className="prose dark:prose-invert max-w-none prose-pre:overflow-x-auto">
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								h1: (props) => {
									const children = React.Children.toArray(props.children).join(" ");
									return <h1 id={slugify(String(children))} {...props} />;
								},
								h2: (props) => {
									const children = React.Children.toArray(props.children).join(" ");
									return <h2 id={slugify(String(children))} {...props} />;
								},
								h3: (props) => {
									const children = React.Children.toArray(props.children).join(" ");
									return <h3 id={slugify(String(children))} {...props} />;
								},
							}}
						>
							{item.docs}
						</ReactMarkdown>
					</div>
				) : null}
			</div>
		</DocsShell>
	);
}


