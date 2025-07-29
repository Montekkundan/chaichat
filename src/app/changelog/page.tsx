import { basehub } from "basehub";
import { RichText } from "basehub/react-rich-text";
import { ThemeToggle } from "~/components/ui/theme-toggle";
import { formatDate, cn } from "~/lib/utils";
import { Tweet } from "react-tweet";
import Image from "next/image";
import Link from "next/link";
import { House } from "@phosphor-icons/react/dist/ssr";

export default async function ChangelogPage() {
	const data = await basehub().query({
		changelog: {
			pages: {
				items: {
					_title: true,
					_sys: {
						createdAt: true,
						lastModifiedAt: true,
					},
					date: true,
					version: true,
					description: true,
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
					tags: {
						items: {
							_title: true,
						},
					},
				},
			},
		},
	});

	// Sort changelog items by date (most recent first)
	const sortedChangelogs = data.changelog.pages.items.sort((a, b) => {
		const dateA = new Date(a.date || a._sys.createdAt).getTime();
		const dateB = new Date(b.date || b._sys.createdAt).getTime();
		return dateB - dateA;
	});

	return (
		<div className="relative min-h-screen bg-background">
			{/* Header */}
			<div className="border-border/50 border-b">
				<div className="relative mx-auto max-w-5xl">
					<div className="flex items-center justify-between p-3">
						<div className="flex items-center gap-4">
							<Link
								href="/"
								className="inline-flex items-center justify-center rounded-md font-medium text-sm ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-3"
								aria-label="Go to home"
							>
								<House size={24} />
							</Link>
							<h1 className="font-semibold text-3xl tracking-tight">Changelog</h1>
						</div>
						<ThemeToggle />
					</div>
				</div>
			</div>

			{/* Timeline */}
			<div className="mx-auto max-w-5xl px-6 pt-10 lg:px-10">
				<div className="relative">
					{sortedChangelogs.map((changelog, index) => {
						const date = new Date(changelog.date || changelog._sys.createdAt);
						const formattedDate = formatDate(date);
						const tags = changelog.tags?.items.map((tag) => tag._title) || [];

						return (
							<div key={index} className="relative">
								<div className="flex flex-col gap-y-6 md:flex-row">
									<div className="flex-shrink-0 md:w-48">
										<div className="pb-10 md:sticky md:top-8">
											<time className="mb-3 block font-medium text-muted-foreground text-sm">
												{formattedDate}
											</time>

											{changelog.version && (
												<div className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border font-bold text-foreground text-sm">
													{changelog.version}
												</div>
											)}
										</div>
									</div>

									{/* Right side - Content */}
									<div className="relative flex-1 pb-10 md:pl-8">
										{/* Vertical timeline line */}
										<div className="absolute top-2 left-0 hidden h-full w-px bg-border md:block">
											{/* Timeline dot */}
											<div className="-translate-x-1/2 absolute z-10 hidden size-3 rounded-full bg-primary md:block" />
										</div>

										<div className="space-y-6">
											<div className="relative z-10 flex flex-col gap-2">
												<h2 className="text-balance font-semibold text-2xl tracking-tight">
													{changelog._title}
												</h2>

												{changelog.description && (
													<p className="text-muted-foreground text-lg">
														{changelog.description}
													</p>
												)}

												{/* Tags */}
												{tags.length > 0 && (
													<div className="flex flex-wrap gap-2">
														{tags.map((tag: string) => (
															<span
																key={tag}
																className="flex h-6 w-fit items-center justify-center rounded-full border bg-muted px-2 font-medium text-muted-foreground text-xs"
															>
																{tag}
															</span>
														))}
													</div>
												)}
											</div>
											
											{/* Rich Text Content */}
											{changelog.content && (
												<div className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-8 prose-headings:text-balance prose-p:text-balance prose-headings:font-semibold prose-headings:tracking-tight prose-p:tracking-tight prose-a:no-underline">
													{changelog.content.json ? (
														<RichText 
															content={changelog.content.json.content}
															blocks={changelog.content.json.blocks}
															components={{
																// Custom components matching your MDX setup
																TweetComponent: (props: any) => {
																	const tweetId = props.tweetId;
																	if (!tweetId) return null;
																	return (
																		<div className="dark mx-auto grid w-full max-w-[500px] place-items-center my-6">
																			<Tweet
																				id={tweetId}
																				components={{
																					AvatarImg: (props: {
																						src: string;
																						alt: string;
																						width: number;
																						height: number;
																					}) => (
																						<Image
																							src={props.src}
																							alt={props.alt}
																							width={props.width}
																							height={props.height}
																						/>
																					),
																				}}
																			/>
																		</div>
																	);
																},
																
																YoutubeComponent: (props: any) => {
																	const youtubeId = props.youtubeId;
																	if (!youtubeId) return null;
																	return (
																		<div className={cn(
																			"relative aspect-video w-full overflow-hidden rounded-md border my-6"
																		)}>
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
																
																VideoComponent: (props: any) => {
																	const url = props.url;
																	if (!url) return null;
																	return (
																		<div className="my-6">
																			<video
																				className="rounded-md border w-full"
																				controls
																				loop
																				src={url}
																			/>
																		</div>
																	);
																},
																
																ImageComponent: (props: any) => {
																	const url = props.url;
																	const title = props._title;
																	if (!url) return null;
																	return (
																		<div className="my-6">
																			{/* eslint-disable-next-line @next/next/no-img-element */}
																			<img
																				className="rounded-md border w-full"
																				src={url}
																				alt={title || "Image"}
																			/>
																		</div>
																	);
																},
															}}
														/>
													) : changelog.content.markdown ? (
														// Fallback markdown content
														<div dangerouslySetInnerHTML={{ __html: changelog.content.markdown }} />
													) : null}
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
