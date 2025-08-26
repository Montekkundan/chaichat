import * as React from "react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { basehub } from "basehub";
import { RichText } from "basehub/react-rich-text";
import path from "node:path";
import fs from "node:fs/promises";
import { DocsShell, DocsSidebar, DocsTOC } from "~/components/registry/registry-layout";
import { extractMarkdownHeadings, extractRichTextHeadings, readAllRegistryItems, readRegistryItem } from "~/lib/registry";
import { BlockPreview } from "~/components/registry/block-preview";
import { OpenInV0Button } from "~/components/open-in-v0-button";
import { CodeBlock, CodeBlockCopyButton } from "~/components/ai-elements/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RegistryCodeBlock } from "~/components/registry/registry-code-block";
export const revalidate = 60; // ISR: refresh registry docs every minute

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

	const bh = await basehub().query({
		_componentInstances: {
			pagesItem: {
				__args: {
					filter: { _title: { eq: slug } },
					first: 1,
				},
				items: {
					_title: true,
					content: {
						json: {
							content: true,
							blocks: {
								on_TweetComponent: {
									_id: true,
									__typename: true,
									_title: true,
									tweetId: true,
								},
								on_YoutubeComponent: {
									_id: true,
									__typename: true,
									_title: true,
									youtubeId: true,
								},
								on_VideoComponent: {
									_id: true,
									__typename: true,
									_title: true,
									url: true,
								},
								on_ImageComponent: {
									_id: true,
									__typename: true,
									_title: true,
									url: true,
								},
							},
						},
						markdown: true,
					},
				},
			},
		},
	});

	const bhDoc = bh?._componentInstances?.pagesItem?.items?.[0];
	const rich = bhDoc?.content?.json;
	const hasRichTextContent = (j: typeof rich): j is NonNullable<typeof rich> =>
		!!(j && Array.isArray(j.content) && j.content.length > 0);

	const headings = hasRichTextContent(rich)
		? extractRichTextHeadings(rich)
		: extractMarkdownHeadings(item.docs);

	function slugify(text: string) {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "")
			.trim()
			.replace(/\s+/g, "-");
	}

	// Prepare files for manual copy section. Prefer built JSON file contents in public/r.
	const filesForManualCopy = await Promise.all(
		(item.files || []).map(async (f) => {
			let content = f.content || "";
			if (!content) {
				try {
					const abs = path.join(process.cwd(), f.path);
					content = await fs.readFile(abs, "utf8");
				} catch {}
			}
			return { path: f.path, type: f.type, content } as { path: string; type?: string; content: string };
		}),
	);

	function languageFromPath(p: string): string {
		const ext = p.split(".").pop() || "";
		if (ext === "tsx") return "tsx";
		if (ext === "ts") return "typescript";
		if (ext === "js") return "javascript";
		if (ext === "tsx" || ext === "jsx") return "tsx";
		if (ext === "css") return "css";
		if (ext === "json") return "json";
		return "plaintext";
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
					{/* <InstallCommand slug={slug} /> */}
				</div>
				<BlockPreview slug={slug} />
				{filesForManualCopy.length > 0 && (
					<div className="space-y-3">
						<Tabs defaultValue="cli" className="w-full">
							<TabsList className="gap-2 p-1.5">
								<TabsTrigger value="cli" className="px-3 py-1.5 text-sm">CLI</TabsTrigger>
								<TabsTrigger value="manual" className="px-3 py-1.5 text-sm">Manual</TabsTrigger>
							</TabsList>

							<TabsContent value="cli">
								<div className="rounded-md border p-3">
									<CodeBlock
										code={`npx shadcn@latest add "http://localhost:3000/r/${slug}.json"`}
										language="bash"
									>
										<CodeBlockCopyButton aria-label="Copy CLI command" />
									</CodeBlock>
								</div>
							</TabsContent>

							<TabsContent value="manual">
								{filesForManualCopy.length > 0 && (
									<Tabs defaultValue={filesForManualCopy[0]?.path || "file-0"} className="w-full">
										<TabsList className="mb-2 gap-2 overflow-x-auto whitespace-nowrap p-1.5">
											{filesForManualCopy.map((f) => (
												<TabsTrigger key={f.path} value={f.path} className="px-2.5 py-1.5 font-mono text-xs sm:text-sm">
													{path.basename(f.path)}
												</TabsTrigger>
											))}
										</TabsList>
										{filesForManualCopy.map((f) => (
											<TabsContent key={f.path} value={f.path}>
												<RegistryCodeBlock
													code={f.content}
													language={languageFromPath(f.path)}
													title={f.path}
													defaultCollapsed
													collapsedMaxHeight={320}
													className="border"
												/>
											</TabsContent>
										))}
									</Tabs>
								)}
							</TabsContent>
						</Tabs>
					</div>
				)}
				{hasRichTextContent(rich) ? (
					<div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-8 prose-headings:text-balance prose-p:text-balance prose-headings:font-semibold prose-headings:tracking-tight prose-p:tracking-tight prose-a:no-underline">
						<RichText
							content={rich.content}
							blocks={rich.blocks}
							components={{
								TweetComponent: (props: { tweetId?: string | null }) => {
									const tweetId = props.tweetId;
									if (!tweetId) return null;
									const { Tweet } = require("react-tweet");
									const Image = require("next/image").default;
									return (
										<div className="dark mx-auto my-6 grid w-full max-w-[500px] place-items-center">
											<Tweet
												id={tweetId}
												components={{
													AvatarImg: (p: { src: string; alt: string; width: number; height: number }) => (
														<Image src={p.src} alt={p.alt} width={p.width} height={p.height} />
													),
												}}
											/>
										</div>
									);
								},
								YoutubeComponent: (props: { youtubeId?: string | null }) => {
									const youtubeId = props.youtubeId;
									if (!youtubeId) return null;
									return (
										<div className="relative my-6 aspect-video w-full overflow-hidden rounded-md border">
											<iframe
												src={`https://www.youtube.com/embed/${youtubeId}`}
												title="YouTube video player"
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
												allowFullScreen
												className="absolute inset-0 h-full w-full"
											/>
										</div>
									);
								},
								VideoComponent: (props: { url?: string | null }) => {
									const url = props.url;
									if (!url) return null;
									return (
										<div className="my-6">
											<video className="w-full rounded-md border" controls loop src={url}>
												<track kind="captions" />
											</video>
										</div>
									);
								},
								ImageComponent: (props: { url?: string | null; _title?: string | null }) => {
									const url = props.url;
									const title = props._title;
									if (!url) return null;
									return (
										<div className="my-6">
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img className="w-full rounded-md border" src={url} alt={title || "Image"} />
										</div>
									);
								},
							}}
						/>
					</div>
				) : item.docs ? (
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


