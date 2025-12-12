import type { UIMessage as MessageType } from "@ai-sdk/react";
import { Check, Copy, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import { Action, Actions } from "~/components/ai-elements/actions";
import {
	Conversation as AIConversation,
	ConversationContent,
	ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Loader } from "~/components/ai-elements/loader";
import { Message, MessageContent } from "~/components/ai-elements/message";
import ModelBadge from "~/components/ai-elements/model-badge";
import { Response } from "~/components/ai-elements/response";
import { cn } from "~/lib/utils";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "../ai-elements/reasoning";
import type { ExtendedMessage } from "~/lib/providers/messages-provider";
import {
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "~/components/ai-elements/sources";
import {
	Tool as ToolCard,
	ToolContent,
	ToolHeader,
	ToolInput,
	ToolOutput,
} from "~/components/ai-elements/tool";

type ConversationProps = {
	messages: (MessageType & {
		model?: string;
		convexId?: string;
		content?: string;
		gateway?: "llm-gateway" | "vercel-ai-gateway";
	})[];
	status?: "streaming" | "ready" | "submitted" | "error";
	onDelete: (id: string) => void;
	onEdit: (id: string, newText: string) => void;
	onReload: () => void;
	onBranch?: (messageIndex: number) => void;
	scrollButtonBottomClass?: string;
	registerScrollApi?: (api: {
		scrollToBottom: () => void;
		getIsAtBottom: () => boolean;
	}) => void;
	gateway?: "llm-gateway" | "vercel-ai-gateway";
};

export function Conversation({
	status,
	messages,
	onDelete: _onDelete,
	onEdit: _onEdit,
	onReload: _onReload,
	onBranch: _onBranch,
	scrollButtonBottomClass = "bottom-24",
	registerScrollApi,
	gateway,
}: ConversationProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const dataUrlToBlob = (dataUrl: string): Blob | null => {
		try {
			const [meta, b64] = dataUrl.split(",");
			const mimeMatch = /data:([^;]+);base64/.exec(meta || "");
			const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
			const binary = typeof atob === "function" ? atob(b64 || "") : "";
			const len = binary.length;
			const bytes = new Uint8Array(len);
			for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
			return new Blob([bytes], { type: mime });
		} catch {
			return null;
		}
	};

	const handleCopyImage = async (url: string, key: string) => {
		try {
			let blob: Blob | null = null;
			if (url.startsWith("data:")) {
				blob = dataUrlToBlob(url);
			} else {
				const res = await fetch(url);
				blob = await res.blob();
			}
			if (!blob) throw new Error("Blob conversion failed");
			const _ClipboardItem = (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
			if (_ClipboardItem && navigator.clipboard?.write) {
				const item = new _ClipboardItem({ [blob.type]: blob });
				await navigator.clipboard.write([item]);
				setCopiedKey(key);
				setTimeout(() => setCopiedKey(null), 1500);
			} else {
				console.warn("Clipboard image copy not supported in this browser.");
			}
		} catch (err) {
			console.error("Failed to copy image: ", err);
		}
	};

	const handleDownloadImage = async (url: string, filename?: string) => {
		try {
			const a = document.createElement("a");
			if (url.startsWith("data:")) {
				a.href = url;
				a.download = filename || "image";
				document.body.appendChild(a);
				a.click();
				a.remove();
			} else {
				const res = await fetch(url);
				const blob = await res.blob();
				const objectUrl = URL.createObjectURL(blob);
				a.href = objectUrl;
				a.download = filename || "image";
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(objectUrl);
			}
		} catch (err) {
			console.error("Failed to download image: ", err);
		}
	};

	// Safe accessors for unknown-typed objects
	const getStringProp = (obj: unknown, key: string): string | undefined => {
		if (obj && typeof obj === "object") {
			const val = (obj as Record<string, unknown>)[key];
			return typeof val === "string" ? val : undefined;
		}
		return undefined;
	};

	// Only show the inline loader for the latest assistant message, so that we dont show it for messages that have/had error
	const latestMessageId =
		messages.length > 0 ? (messages[messages.length - 1]?.id ?? null) : null;

	const messageHasRenderableContent = (msg: MessageType) => {
		const parts = Array.isArray(msg.parts) ? msg.parts : [];
		return parts.some((part) => {
			if (part.type === "text") return (part.text || "").trim().length > 0;
			if (part.type === "reasoning") return (part.text || "").trim().length > 0;
			// Consider only actually visible content as renderable
			if (part.type === "file") return true;
			if ((part as { type?: string }).type === "image") return true;
			// Do NOT treat tool input/calls or other ephemeral parts as renderable
			return false;
		});
	};

	// Latest message helper and bottom loader condition for current turn
	const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
	const showBottomLoader =
		(status === "submitted" || status === "streaming") &&
		(!latestMessage || latestMessage.role !== "assistant");

	const handleCopy = async (text: string, key: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedKey(key);
			setTimeout(() => setCopiedKey(null), 1500);
		} catch (err) {
			console.error("Failed to copy text: ", err);
		}
	};

	function BottomContextBridge() {
		const { scrollToBottom, isAtBottom } = useStickToBottomContext();
		const isAtBottomRef = useRef<boolean>(isAtBottom);
		useEffect(() => {
			isAtBottomRef.current = isAtBottom;
		}, [isAtBottom]);
		useEffect(() => {
			if (!registerScrollApi) return;
			registerScrollApi({
				scrollToBottom: () => scrollToBottom(),
				getIsAtBottom: () => isAtBottomRef.current,
			});
		}, [registerScrollApi, scrollToBottom]);
		return null;
	}

	return (
		<div ref={containerRef} className="relative flex h-full w-full flex-col">
			<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
				<div className="flex h-app-header w-full bg-background lg:hidden lg:h-0" />
				<div className="mask-b-from-4% mask-b-to-100% flex h-app-header w-full bg-background lg:hidden" />
			</div>

			<AIConversation className="relative h-full w-full overflow-y-hidden">
				{/* Expose stick-to-bottom methods to parent when requested */}
				{registerScrollApi ? <BottomContextBridge /> : null}
				<ConversationContent className="mx-auto flex w-full max-w-3xl flex-col items-center pt-20 pb-40">
					{messages.map((message) => {
						const isAssistant = message.role === "assistant";
						const hasRenderableContent = messageHasRenderableContent(
							message as MessageType,
						);
						const shouldShowInlineLoader =
							isAssistant &&
							(status === "submitted" || status === "streaming") &&
							message.id === latestMessageId &&
							!hasRenderableContent;

						return (
							<Message from={message.role} key={message.id}>
								<MessageContent>
									{(() => {
										// Render sources list for assistant messages when present
										if (!isAssistant) return null;
										const rawParts = Array.isArray((message as MessageType).parts)
											? ((message as MessageType).parts)
											: [];
										type SourcePart = { type?: string; url?: string; href?: string; title?: string };
										const sourceParts: SourcePart[] = rawParts
											.filter((p) => {
												const t = getStringProp(p, "type");
												return t === "source-url" || t === "source";
											})
											.map((p) => ({
												type: getStringProp(p, "type"),
												url: getStringProp(p, "url"),
												href: getStringProp(p, "href"),
												title: getStringProp(p, "title"),
											}));

										// Fallback: some providers may attach sources in metadata
										const meta = (message as { metadata?: unknown }).metadata as { sources?: Array<{ url?: string; title?: string }> } | undefined;
										const metaSources: Array<{ url?: string; title?: string }> = Array.isArray(meta?.sources) ? (meta?.sources as Array<{ url?: string; title?: string }>) : [];

										const totalSources = sourceParts.length + metaSources.length;
										if (totalSources === 0) return null;

										return (
											<Sources className="w-full">
												<SourcesTrigger count={totalSources} />
												<SourcesContent>
													{sourceParts.map((sp, i) => {
														const href = sp.url || sp.href || "";
														const title = sp.title || href;
														if (!href) return null;
														return (
															<Source key={`${message.id}-sp-${i}`} href={href} title={title} />
														);
													})}
													{metaSources.map((ms, j) => {
														const href = ms.url || "";
														const title = ms.title || href;
														if (!href) return null;
														return (
															<Source key={`${message.id}-ms-${j}`} href={href} title={title} />
														);
													})}
												</SourcesContent>
											</Sources>
										);
									})()}

									{(() => {
										// Render tool UI parts (e.g., webSearch) for assistant messages
										if (!isAssistant) return null;
										const parts = Array.isArray(message.parts) ? (message.parts as Array<unknown>) : [];
										const toolParts = parts.filter((p) => {
											const t = getStringProp(p, "type");
											return typeof t === "string" && t.startsWith("tool-");
										}) as Array<{
											type: `tool-${string}`;
											state: "input-streaming" | "input-available" | "output-available" | "output-error";
											input?: unknown;
											output?: unknown;
											errorText?: string;
										}>;

										if (toolParts.length === 0) return null;

										return (
											<div className="w-full space-y-2">
												{toolParts.map((tp, idx) => (
														<ToolCard
															key={`${message.id}-tool-${idx}`}
															defaultOpen={false}
														>
														<ToolHeader type={tp.type} state={tp.state} />
														<ToolContent>
															<ToolInput input={tp.input} />
															<ToolOutput
																errorText={tp.errorText}
																output={tp.output ? (
																	<Response>
																		{typeof tp.output === "string"
																			? (tp.output as string)
																		: JSON.stringify(tp.output, null, 2)}
																	</Response>
																) : null}
															/>
														</ToolContent>
													</ToolCard>
												))}
											</div>
										);
									})()}
									{shouldShowInlineLoader ? (
										<Loader />
									) : (
										(() => {
											const parts = Array.isArray(message.parts)
												? message.parts
												: [];
											const textParts = parts.filter((p) => p.type === "text");
											const hasTextParts = textParts.length > 0;

											// Collect all reasoning parts to combine them
											const reasoningParts = parts.filter((part) => {
												if (part.type !== "reasoning") return false;
												let text: string | undefined;
												if (
													typeof part === "object" &&
													part !== null &&
													"text" in part
												) {
													const maybe = (
														part as unknown as { text?: unknown }
													).text;
													if (typeof maybe === "string") text = maybe;
												}
												return text && text.trim().length > 0;
											});

											const combinedReasoningText = reasoningParts
												.map((part) => {
													const maybe = (
														part as unknown as { text?: unknown }
													).text;
													return typeof maybe === "string" ? maybe : "";
												})
												.join("\n\n");

											return (
												<>


													{/* Render combined reasoning if any exists */}
													{combinedReasoningText && (
														<Reasoning
															key={`${message.id}-reasoning`}
															className="w-full"
															isStreaming={status === "streaming"}
															defaultOpen={status === "streaming"}
														>
															<ReasoningTrigger />
															<ReasoningContent>{combinedReasoningText}</ReasoningContent>
														</Reasoning>
													)}

													{/* Render attachments (uploaded images) */}
													{(() => {
														const extendedMessage = message as ExtendedMessage;
														const attachments = extendedMessage.attachments;
														const hasFileParts = parts.some((p) => p.type === "file");
														return !hasFileParts && attachments && attachments.length > 0 ? (
															<div className="mb-4 space-y-2">
																{attachments.map((attachment, idx: number) => {
																	const attKeyBase = `${message.id}-attachment-${idx}`;
																	return (
																		<div key={attKeyBase} className="max-w-md">
																			<div className="group rounded-xl overflow-hidden border bg-muted/40 p-2 md:p-3 shadow-sm">
																				{attachment.contentType?.startsWith('image/') ? (
																					<>
																						<img
																							src={attachment.url}
																							alt={attachment.name}
																							className="w-full h-auto max-h-80 object-contain rounded-md bg-background"
																							style={{ color: "transparent" }}
																						/>
																						<Actions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
																							{(() => {
																								const key = `${attKeyBase}-img`;
																								const isCopied = copiedKey === key;
																								return (
																									<>
																										<Action
																											tooltip="Copy image"
																											label="Copy image"
																											onClick={() => handleCopyImage(attachment.url, key)}
																											aria-label={isCopied ? "Copied" : "Copy image to clipboard"}
																											disabled={isCopied}
																										>
																											<div className={cn("transition-all", isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0")}>
																												<Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
																											</div>
																											<div className={cn("absolute transition-all", isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100")}>
																												<Copy size={16} strokeWidth={2} aria-hidden="true" />
																											</div>
																										</Action>

																										<Action
																											tooltip="Download"
																											label="Download"
																											onClick={() => handleDownloadImage(attachment.url, attachment.name)}
																											aria-label="Download image"
																										>
																											<Download size={16} strokeWidth={2} aria-hidden="true" />
																										</Action>
																									</>
																								);
																							})()}
																						</Actions>
																					</>
																				) : (
																					<div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
																						<div className="text-sm">📎</div>
																						<div className="flex-1">
																							<div className="text-sm font-medium">{attachment.name}</div>
																							<div className="text-xs text-muted-foreground">
																								{(attachment.size / 1024).toFixed(2)} KB
																							</div>
																						</div>
																					</div>
																				)}
																			</div>
																		</div>
																	);
																})}
															</div>
														) : null;
													})()}

													{parts.map((part, i) => {
														switch (part.type) {
															case "reasoning":
																// Skip individual reasoning parts since we combined them above
																return null;
															case "file": {
																const key = `${message.id}-file-${i}`;
																const fileData = part as { url?: string; mediaType?: string; filename?: string };

																// Handle image files
																if (fileData.mediaType?.startsWith('image/') && fileData.url) {
																	return (
																		<div key={key} className="max-w-md">
																			<div className="group rounded-xl overflow-hidden border bg-muted/40 p-2 md:p-3 shadow-sm">
																				<img
																					src={fileData.url}
																					alt={fileData.filename || "Image"}
																					className="w-full h-auto max-h-80 object-contain rounded-md bg-background"
																					style={{ color: "transparent" }}
																				/>
																				<Actions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
																					{(() => {
																						const imgKey = `${key}-img`;
																						const isCopied = copiedKey === imgKey;
																						return (
																							<>
																								<Action
																									tooltip="Copy image"
																									label="Copy image"
																									onClick={() => fileData.url && handleCopyImage(fileData.url, imgKey)}
																									aria-label={isCopied ? "Copied" : "Copy image to clipboard"}
																									disabled={!fileData.url || isCopied}
																								>
																									<div className={cn("transition-all", isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0")}>
																										<Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
																									</div>
																									<div className={cn("absolute transition-all", isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100")}>
																										<Copy size={16} strokeWidth={2} aria-hidden="true" />
																									</div>
																								</Action>

																								<Action
																									tooltip="Download"
																									label="Download"
																									onClick={() => fileData.url && handleDownloadImage(fileData.url, fileData.filename)}
																									aria-label="Download image"
																									disabled={!fileData.url}
																								>
																									<Download size={16} strokeWidth={2} aria-hidden="true" />
																								</Action>
																							</>
																						);
																					})()}
																				</Actions>
																			</div>
																		</div>
																	);
																}

																// Handle other file types
																return (
																	<div key={key} className="w-full">
																		<div className="rounded-lg overflow-hidden border bg-muted/30 p-2">
																			<div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
																				<div className="text-sm">📎</div>
																				<div className="flex-1">
																					<div className="text-sm font-medium">{fileData.filename || "File"}</div>
																					<div className="text-xs text-muted-foreground">
																						{fileData.mediaType || "Unknown type"}
																					</div>
																				</div>
																			</div>
																		</div>
																	</div>
																);
															}
															case "text": {
																const key = `${message.id}-text-${i}`;
																const isCopied = copiedKey === key;
																const isLastTextBlock = i === parts.length - 1 ||
																	parts.slice(i + 1).every(p => p.type !== "text");
																const showActions =
																	isLastTextBlock && message.role === "assistant";

																// If assistant returned raw <img> HTML, extract and render safely with actions
																const raw = part.text?.trim() || "";
																const imgMatch = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i.exec(raw);
																if (message.role === "assistant" && imgMatch) {
																	const src = imgMatch[1];
																	const altMatch = /alt=["']([^"']*)["']/i.exec(raw);
																	const alt = altMatch ? altMatch[1] : "Image";
																	const imgKey = `${key}-htmlimg`;
																	const copied = copiedKey === imgKey;
																	return (
																		<div key={key} className="max-w-md w-full">
																			<div className="group rounded-xl overflow-hidden border bg-muted/40 p-2 md:p-3 shadow-sm">
																				<img src={src} alt={alt} className="w-full h-auto max-h-80 object-contain rounded-md bg-background" style={{ color: "transparent" }} />
																				<Actions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
																					<Action
																						tooltip="Copy image"
																						label="Copy image"
																						onClick={() => src && handleCopyImage(src, imgKey)}
																						aria-label={copied ? "Copied" : "Copy image to clipboard"}
																						disabled={!src || copied}
																					>
																						<div className={cn("transition-all", copied ? "scale-100 opacity-100" : "scale-0 opacity-0")}>
																							<Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
																						</div>
																						<div className={cn("absolute transition-all", copied ? "scale-0 opacity-0" : "scale-100 opacity-100")}>
																							<Copy size={16} strokeWidth={2} aria-hidden="true" />
																						</div>
																					</Action>
																					<Action
																						tooltip="Download"
																						label="Download"
																						onClick={() => src && handleDownloadImage(src, typeof (message as { filename?: string }).filename === 'string' ? (message as { filename?: string }).filename : undefined)}
																						aria-label="Download image"
																						disabled={!src}
																					>
																						<Download size={16} strokeWidth={2} aria-hidden="true" />
																					</Action>
																				</Actions>
																			</div>
																		</div>
																	);
																}
																return (
																	<div key={key} className="w-full">
																		<Response
																			parseIncompleteMarkdown={status === "streaming"}
																			allowedImagePrefixes={["*"]}
																			allowedLinkPrefixes={["*"]}
																			defaultOrigin=""
																		>
																			{part.text}
																		</Response>
																		{showActions && (
																			<Actions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
																				{message.role === "assistant" &&
																					typeof (message as { model?: string }).model === "string" && (
																						<div className="mr-2">
																							<ModelBadge
																								modelId={
																									(message as { model?: string })
																										.model
																								}
																								gateway={
																									(
																										message as {
																											gateway?:
																											| "llm-gateway"
																											| "vercel-ai-gateway";
																										}
																									).gateway || gateway
																								}
																							/>
																						</div>
																					)}
																				<Action
																					tooltip="Copy"
																					label="Copy"
																					onClick={() => handleCopy(part.text, key)}
																					aria-label={
																						isCopied
																							? "Copied"
																							: "Copy to clipboard"
																					}
																					disabled={isCopied}
																				>
																					<div
																						className={cn(
																							"transition-all",
																							isCopied
																								? "scale-100 opacity-100"
																								: "scale-0 opacity-0",
																						)}
																					>
																						<Check
																							className="stroke-emerald-500"
																							size={16}
																							strokeWidth={2}
																							aria-hidden="true"
																						/>
																					</div>
																					<div
																						className={cn(
																							"absolute transition-all",
																							isCopied
																								? "scale-0 opacity-0"
																								: "scale-100 opacity-100",
																						)}
																					>
																						<Copy
																							size={16}
																							strokeWidth={2}
																							aria-hidden="true"
																						/>
																					</div>
																				</Action>
																			</Actions>
																		)}
																	</div>
																);
															}
															default:
																return null;
														}
													})}
													{/* Fallback: while streaming and before any text arrives, still show model badge */}
													{message.role === "assistant" &&
														status === "streaming" &&
														!hasTextParts &&
														typeof (message as { model?: string }).model === "string" && (
															<Actions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
																<div className="mr-2">
																	<ModelBadge
																		modelId={
																			(message as { model?: string }).model
																		}
																		gateway={
																			(
																				message as {
																					gateway?:
																					| "llm-gateway"
																					| "vercel-ai-gateway";
																				}
																			).gateway || gateway
																		}
																	/>
																</div>
															</Actions>
														)}
												</>
											);
										})()
									)}
								</MessageContent>
								{/* User message actions outside the bubble */}
								{message.role === "user" &&
									(() => {
										const parts = Array.isArray(message.parts)
											? message.parts
											: [];
										const userText = parts
											.filter((p) => p.type === "text")
											.map((p) => p.text)
											.join("\n");
										const key = `${message.id}-user`;
										const isCopied = copiedKey === key;
										return (
											<Actions className="mt-2 px-2 opacity-0 transition-opacity group-hover:opacity-100">
												<Action
													tooltip="Copy"
													label="Copy"
													onClick={() => handleCopy(userText, key)}
													aria-label={isCopied ? "Copied" : "Copy to clipboard"}
													disabled={isCopied}
												>
													<div
														className={cn(
															"transition-all",
															isCopied
																? "scale-100 opacity-100"
																: "scale-0 opacity-0",
														)}
													>
														<Check
															className="stroke-emerald-500"
															size={16}
															strokeWidth={2}
															aria-hidden="true"
														/>
													</div>
													<div
														className={cn(
															"absolute transition-all",
															isCopied
																? "scale-0 opacity-0"
																: "scale-100 opacity-100",
														)}
													>
														<Copy
															size={16}
															strokeWidth={2}
															aria-hidden="true"
														/>
													</div>
												</Action>
											</Actions>
										);
									})()}
							</Message>
						);
					})}
					{/* Fallback loader: only before the first assistant message for the current turn */}
					{showBottomLoader ? (
						<div className="w-full px-6">
							<Loader />
						</div>
					) : null}
				</ConversationContent>
				<ConversationScrollButton
					className={`z-20 shadow-sm ${scrollButtonBottomClass}`}
				/>
			</AIConversation>
		</div>
	);
}
