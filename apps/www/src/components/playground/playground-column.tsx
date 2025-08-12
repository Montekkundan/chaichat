"use client";

import { useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { LinkIcon, LinkSimpleBreakIcon } from "@phosphor-icons/react";
import {
	ChevronLeft,
	ChevronRight,
	MoreHorizontal,
	Plus,
	RotateCcw,
	SendIcon,
	Settings,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModelSelector } from "~/components/chat-input/model-selector";
import { Conversation } from "~/components/chat/conversation";
import { ModelConfigPanel } from "~/components/playground/model-config";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useLLMModels } from "~/hooks/use-models";
import {
	type ChatColumn,
	usePlayground,
} from "~/lib/providers/playground-provider";
import type { LLMGatewayModel } from "~/types/llmgateway";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface PlaygroundColumnProps {
	column: ChatColumn;
	columnIndex: number;
}

export function PlaygroundColumn({
	column,
	columnIndex,
}: PlaygroundColumnProps) {
	const { user } = useUser();
  const getKeys = useAction(api.userKeys.getKeys);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);
  const [hasLlmKey, setHasLlmKey] = useState<boolean>(false);
  const [hasAiKey, setHasAiKey] = useState<boolean>(false);

	// Per-column scroll API so Enter can scroll to bottom if needed
	const conversationScrollApiRef = useRef<{
		scrollToBottom: () => void;
		getIsAtBottom: () => boolean;
	} | null>(null);

	// Per-column gateway source and models (controlled by ModelSelector)
	const [columnSource, setColumnSource] = useState<"aigateway" | "llmgateway">(
		column.gatewaySource || "llmgateway",
	);
	// Keep local state in sync with provider/state updates
	useEffect(() => {
		const next = (column.gatewaySource || "llmgateway") as
			| "aigateway"
			| "llmgateway";
		setColumnSource(next);
	}, [column.gatewaySource]);

  // Load both keys on mount and on apiKeysChanged
  useEffect(() => {
    const loadKeys = async () => {
      try {
        if (user?.id) {
          const result = (await getKeys({})) as {
            llmGatewayApiKey?: string;
            aiGatewayApiKey?: string;
          };
          setHasLlmKey(Boolean(result?.llmGatewayApiKey));
          setHasAiKey(Boolean(result?.aiGatewayApiKey));
        } else {
          const { getAllKeys } = await import("~/lib/local-keys");
          const local = await getAllKeys();
          setHasLlmKey(Boolean(local?.llmGatewayApiKey));
          setHasAiKey(Boolean(local?.aiGatewayApiKey));
        }
      } catch {
        setHasLlmKey(false);
        setHasAiKey(false);
      }
    };
    void loadKeys();
    const onChanged = () => void loadKeys();
    window.addEventListener("apiKeysChanged", onChanged);
    return () => window.removeEventListener("apiKeysChanged", onChanged);
  }, [user?.id, getKeys]);
	const {
		models,
		isLoading: isModelsLoading,
		error: modelsError,
	} = useLLMModels({ source: columnSource, controlled: true });

	const formatPrice = useCallback((price: string | undefined) => {
		if (!price || price === "undefined" || price === "null") return "Free";
		const num = Number.parseFloat(price);
		if (Number.isNaN(num) || num === 0) return "Free";
		if (num < 0.001) return `$${(num * 1000000).toFixed(2)}/1M`;
		if (num < 1) return `$${(num * 1000).toFixed(2)}/1K`;
		return `$${num.toFixed(2)}`;
	}, []);

	// Resolve the selected model (supports provider-prefixed ids like `provider/model`)
	const { selectedModel, selectedProviderLabel, promptPrice, completionPrice } =
		useMemo(() => {
			const selectedId = column.modelId || "";
			let model: LLMGatewayModel | undefined;
			let providerLabel: string | undefined;
			let prompt: string | undefined;
			let completion: string | undefined;

			if (!selectedId)
				return {
					selectedModel: undefined,
					selectedProviderLabel: undefined,
					promptPrice: undefined,
					completionPrice: undefined,
				};

			if (selectedId.includes("/")) {
				const firstSlash = selectedId.indexOf("/");
				const provider = selectedId.substring(0, firstSlash);
				const modelName = selectedId.substring(firstSlash + 1);
				model = models.find((m) =>
					m.providers?.some(
						(p) =>
							p.providerId === provider &&
							(p.modelName === modelName ||
								p.modelName.endsWith(`/${modelName}`)),
					),
				);
				const providerInfo = model?.providers?.find(
					(p) => p.providerId === provider,
				);
				providerLabel = providerInfo ? providerInfo.providerId : undefined;
				prompt = providerInfo?.pricing?.prompt ?? model?.pricing?.prompt;
				completion =
					providerInfo?.pricing?.completion ?? model?.pricing?.completion;
			} else {
				model = models.find(
					(m) => m.id === selectedId || m.name === selectedId,
				);
				prompt = model?.pricing?.prompt;
				completion = model?.pricing?.completion;
			}

			return {
				selectedModel: model,
				selectedProviderLabel: providerLabel,
				promptPrice: formatPrice(prompt),
				completionPrice: formatPrice(completion),
			};
		}, [column.modelId, models, formatPrice]);

	const {
		columns,
		sharedInput,
		updateColumn,
		removeColumn,
		clearColumn,
		moveColumnLeft,
		moveColumnRight,
		toggleColumnSync,
		updateSharedInput,
		updateColumnInput,
		sendToColumn,
		sendToSyncedColumns,
		addColumn,
		maxColumns,
		registerColumnScrollApi,
	} = usePlayground();

	const handleModelChange = (modelId: string) => {
		updateColumn(column.id, { modelId });
	};

	// Persist per-column gateway selection back to provider state
	const handleSourceChange = useCallback(
		(src: "aigateway" | "llmgateway") => {
			setColumnSource(src);
			updateColumn(column.id, { gatewaySource: src });
		},
		[column.id, updateColumn],
	);

	const handleInputChange = (value: string) => {
		if (column.synced) {
			updateSharedInput(value);
		} else {
			updateColumnInput(column.id, value);
		}
	};

	const handleConfigChange = (config: Partial<typeof column.config>) => {
		updateColumn(column.id, { config: { ...column.config, ...config } });
	};

	const handleSend = async () => {
		if (isSubmitting) return;
		const inputValue = column.synced ? sharedInput : column.input;
		if (!inputValue.trim()) return;

		// Optimistically clear the input for snappy UX
		if (column.synced) {
			updateSharedInput("");
		} else {
			updateColumnInput(column.id, "");
		}

		setIsSubmitting(true);

		// Scroll to bottom if not at bottom already
		try {
			if (
				conversationScrollApiRef.current &&
				!conversationScrollApiRef.current.getIsAtBottom()
			) {
				conversationScrollApiRef.current.scrollToBottom();
			}
		} catch {}

		try {
			if (column.synced) {
				// If this column is synced, delegate to the provider to handle all synced columns
				await sendToSyncedColumns(inputValue);
			} else {
				// Handle individual column send
				await sendToColumn(column.id, inputValue);
			}

			// Clear input
			if (column.synced) {
				updateSharedInput("");
			} else {
				updateColumnInput(column.id, "");
			}
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

  const currentInput = column.synced ? sharedInput : column.input;
  const hasRequiredKey = columnSource === "aigateway" ? hasAiKey : hasLlmKey;
	const canMoveLeft = columnIndex > 0;
	const canMoveRight = columnIndex < columns.length - 1;
	const canRemove = columns.length > 1;

	const derivedStatus: "submitted" | "streaming" | "ready" | "error" =
		column.status && column.status !== "ready"
			? column.status
			: isSubmitting
				? "submitted"
				: column.isStreaming
					? "streaming"
					: "ready";

	return (
		<div className="flex h-full min-h-0 flex-col rounded-xl border">
			<div className="h-full min-h-0 w-full rounded-b-md">
				<div
					id={`scroll-container-${column.id}_${columnIndex}`}
					className="flex h-full min-h-0 flex-no-wrap flex-col"
					style={{ overflowAnchor: "none" }}
				>
					{/* Column header */}
					<div className="sticky top-0 z-10 min-h-0 min-w-0 flex-shrink-0">
						<div className="m-1 flex items-center justify-between py-2 pr-2 pl-3 backdrop-blur">
							<div className="min-w-0 flex-1">
								<div className="flex flex-1 flex-col">
									<div className="relative grid gap-2">
										<ModelSelector
											selectedModelId={column.modelId}
											setSelectedModelId={handleModelChange}
											className="ease inline-flex h-[32px] w-full max-w-[288px] items-center justify-between truncate rounded-md border bg-background px-3 py-0.5 font-mono text-foreground leading-6 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
											isUserAuthenticated={!!user?.id}
											source={columnSource}
											onSourceChange={handleSourceChange}
										/>
									</div>
								</div>
							</div>

							<div className="ml-1 flex items-center">
								<div className="flex items-center">
									{/* Sync badge */}
									{column.synced && (
										<div className="mx-2 hidden h-6 items-center rounded-full bg-secondary px-3 text-md text-secondary-foreground text-sm lg:flex">
											Synced
										</div>
									)}

									{/* Model Configuration button */}
									<DropdownMenu
										open={isConfigMenuOpen}
										onOpenChange={(open) => {
											setIsConfigMenuOpen(open);
											if (open) {
												setTimeout(() => {
													const el = document.getElementById(
														"temperature",
													) as HTMLInputElement | null;
													el?.focus();
													el?.select?.();
												}, 0);
											}
										}}
									>
										<DropdownMenuTrigger asChild>
											<Button
												aria-label="Model Settings"
												variant={"ghost"}
												size={"icon"}
											>
												<span className="button_content__eYZtX button_flex___f_3o">
													<span className="pointer-events-none flex rounded-md p-2">
														<Settings className="h-4 w-4" />
													</span>
												</span>
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-[420px]">
											<div className="space-y-2 p-2">
												<div className="px-1 font-semibold text-sm">
													Model Configuration
												</div>
												<ModelConfigPanel
													modelId={column.modelId}
													value={column.config}
													onChange={(u) => handleConfigChange(u)}
												/>
											</div>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>

								{/* Add Column button */}
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												variant={"ghost"}
												onClick={addColumn}
												disabled={columns.length >= maxColumns}
												aria-disabled={columns.length >= maxColumns}
											>
												<Plus className="h-4 w-4" />
											</Button>
										</span>
									</TooltipTrigger>
									{columns.length >= maxColumns && (
										<TooltipContent sideOffset={6}>
											Cannot add more columns
										</TooltipContent>
									)}
								</Tooltip>

								<Button
									onClick={() => toggleColumnSync(column.id)}
									variant={"ghost"}
									size={"icon"}
								>
									{column.synced ? (
										<LinkIcon size={16} />
									) : (
										<LinkSimpleBreakIcon size={16} />
									)}
								</Button>
								{/* Menu button for more options */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											aria-label="Add Model"
											variant={"ghost"}
											size={"icon"}
										>
											<span className="button_content__eYZtX button_flex___f_3o button_center__bCjE5">
												<span className="pointer-events-none flex rounded-md p-2">
													<MoreHorizontal className="h-4 w-4" />
												</span>
											</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<button
											type="button"
											onClick={() => clearColumn(column.id)}
											className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
										>
											<RotateCcw className="mr-2 h-4 w-4" />
											Clear Chat
										</button>
										<Separator className="my-1" />
										<DropdownMenuItem
											onClick={() => moveColumnLeft(column.id)}
											disabled={!canMoveLeft}
										>
											<ChevronLeft className="mr-2 h-4 w-4" />
											Scroll Left
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => moveColumnRight(column.id)}
											disabled={!canMoveRight}
										>
											<ChevronRight className="mr-2 h-4 w-4" />
											Scroll Right
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => removeColumn(column.id)}
											disabled={!canRemove}
											className="text-destructive"
										>
											<Trash2 className="mr-2 h-4 w-4" />
											Delete Column
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</div>
					<Separator />

					{/* Messages content area */}
					<div className="min-h-0 min-w-0 flex-1">
						<div
							id={`scroll-container-inner-${column.id}_${columnIndex}`}
							className="scrolling-touch scrolling-gpu relative h-full w-full overscroll-y-contain"
						>
							{column.messages.length > 0 ? (
								<Conversation
									messages={column.messages}
									status={derivedStatus}
									gateway={
										columnSource === "aigateway"
											? "vercel-ai-gateway"
											: "llm-gateway"
									}
									scrollButtonBottomClass="bottom-2"
									registerScrollApi={(api) => {
										conversationScrollApiRef.current = api;
										// Register with provider so synced sends can scroll all columns
										try {
											registerColumnScrollApi(column.id, api ?? null);
										} catch {}
									}}
									onDelete={(id) => {
										updateColumn(column.id, {
											messages: column.messages.filter((msg) => msg.id !== id),
										});
									}}
									onEdit={(id, newText) => {
										updateColumn(column.id, {
											messages: column.messages.map((msg) =>
												msg.id === id
													? {
															...msg,
															content: newText,
															parts: [{ type: "text", text: newText }],
														}
													: msg,
											),
										});
									}}
									onReload={() => {
										// Find the last user message and resend
										const lastUserMessage = [...column.messages]
											.reverse()
											.find((msg) => msg.role === "user");
										if (lastUserMessage?.content) {
											// Remove messages after the last user message
											const messagesReversed = [...column.messages].reverse();
											const lastUserIndexFromEnd = messagesReversed.findIndex(
												(msg) => msg.role === "user",
											);
											const lastUserIndex =
												column.messages.length - 1 - lastUserIndexFromEnd;
											const messagesUpToLastUser = column.messages.slice(
												0,
												lastUserIndex + 1,
											);
											updateColumn(column.id, {
												messages: messagesUpToLastUser,
											});

											// Resend the message
											if (column.synced) {
												sendToSyncedColumns(lastUserMessage.content);
											} else {
												sendToColumn(column.id, lastUserMessage.content);
											}
										}
									}}
								/>
							) : (
								// Start page with model info (minimal)
								<div className="flex size-full items-center justify-center px-4">
									<div className="w-full max-w-xl rounded-lg border bg-white shadow-xs dark:bg-black">
										<div className="p-5 text-sm">
											<div className="flex items-center gap-2">
												<div className="space-x-1">
													<span className="font-medium text-zinc-800 dark:text-zinc-200">
														{selectedModel?.name ?? column.modelId}
													</span>
													{selectedProviderLabel && (
														<span className="text-zinc-600 dark:text-zinc-400">
															· {selectedProviderLabel}
														</span>
													)}
												</div>
											</div>

											{isModelsLoading ? (
												<div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
													Loading model details…
												</div>
											) : modelsError ? (
												<div className="mt-3 text-red-500 text-xs">
													{modelsError}
												</div>
											) : (
												<>
													<div className="mt-2 text-xs text-zinc-600 leading-relaxed dark:text-zinc-400">
														{selectedModel?.description ||
															"Start a conversation to test this model."}
													</div>
													<div className="mt-3 flex flex-wrap gap-2 text-[11px]">
														<span className="rounded border px-2 py-1">
															Context: {selectedModel?.context_length ?? "-"}{" "}
															tokens
														</span>
														<span className="rounded border px-2 py-1">
															Input: {promptPrice}
														</span>
														<span className="rounded border px-2 py-1">
															Output: {completionPrice}
														</span>
													</div>
												</>
											)}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Sticky bottom input */}
					<div className="sticky bottom-0 min-h-0 min-w-0 flex-shrink-0">
						<div className="flex items-center gap-2 border-t bg-background-200 p-3 pr-2.5">
							<form
								className="relative flex w-full items-center"
								onSubmit={(e) => {
									e.preventDefault();
									handleSend();
								}}
							>
                        <textarea
                          placeholder={
                            hasRequiredKey
                              ? (column.synced ? "Type a synced message..." : "Type your message…")
                              : `Please add your ${columnSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key to start chatting`
                          }
                          value={currentInput}
                          onChange={(e) => {
                            handleInputChange(e.target.value);
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = "auto";
                            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                          }}
                          className="min-h-[38px] max-h-[120px] flex-1 resize-none overflow-y-auto rounded-md border bg-background-100 py-2 pl-4 pr-9 text-sm focus:border-zinc-400 focus:outline-none focus:ring-0 dark:focus:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                          spellCheck="false"
                          rows={1}
                          style={{
                            fontFamily: "var(--font-geist-sans)",
                            height: "38px",
                            lineHeight: "1.5",
                          }}
                          disabled={!hasRequiredKey}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (!hasRequiredKey) return;
                              handleSend();
                            }
                          }}
                        />
								<div className="absolute right-1 bottom-[3px] inline-flex items-center justify-end">
                                    <button
										type="button"
										aria-label="Send Message"
                                      onClick={handleSend}
                                      disabled={!hasRequiredKey || isSubmitting || !currentInput.trim()}
										className="button_base__IZQUR reset_reset__sz7UJ button_button__dyHAB reset_reset__sz7UJ geist-new-themed geist-new-tertiary geist-new-tertiary-fill button_tertiary__t8MGO button_shape__4NO5k button_small__BoUqH button_invert__WPMQW"
										data-geist-button=""
										data-prefix="false"
										data-suffix="false"
										data-version="v1"
										style={
											{ "--geist-icon-size": "16px" } as React.CSSProperties
										}
									>
										<span className="button_content__eYZtX button_flex___f_3o">
											<span className="pointer-events-none flex rounded-md p-2">
												<SendIcon className="h-4 w-4" />
											</span>
										</span>
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
