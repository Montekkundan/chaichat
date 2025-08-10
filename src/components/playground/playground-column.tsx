"use client";

import { useCallback, useMemo, useState } from "react";
import { Settings, MoreHorizontal, Link2, ChevronLeft, ChevronRight, Trash2, RotateCcw, Plus } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { ModelSelector } from "~/components/chat-input/model-selector";
import { usePlayground, type ChatColumn } from "~/lib/providers/playground-provider";
import { Conversation } from "~/components/chat/conversation";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import type { LLMGatewayModel } from "~/types/llmgateway";
import { useLLMModels } from "~/hooks/use-models";

interface PlaygroundColumnProps {
	column: ChatColumn;
	columnIndex: number;
}

export function PlaygroundColumn({
	column,
	columnIndex,
}: PlaygroundColumnProps) {
	const { user } = useUser();

	const [isSubmitting, setIsSubmitting] = useState(false);

	// Shared cached models
	const { models, isLoading: isModelsLoading, error: modelsError } = useLLMModels();

	const formatPrice = useCallback((price: string | undefined) => {
		if (!price || price === "undefined" || price === "null") return "Free";
		const num = Number.parseFloat(price);
		if (Number.isNaN(num) || num === 0) return "Free";
		if (num < 0.001) return `$${(num * 1000000).toFixed(2)}/1M`;
		if (num < 1) return `$${(num * 1000).toFixed(2)}/1K`;
		return `$${num.toFixed(2)}`;
	}, []);

	// Resolve the selected model (supports provider-prefixed ids like `provider/model`)
	const { selectedModel, selectedProviderLabel, promptPrice, completionPrice } = useMemo(() => {
		const selectedId = column.modelId || "";
		let model: LLMGatewayModel | undefined;
		let providerLabel: string | undefined;
		let prompt: string | undefined;
		let completion: string | undefined;

		if (!selectedId) return { selectedModel: undefined, selectedProviderLabel: undefined, promptPrice: undefined, completionPrice: undefined };

		if (selectedId.includes("/")) {
			const firstSlash = selectedId.indexOf("/");
			const provider = selectedId.substring(0, firstSlash);
			const modelName = selectedId.substring(firstSlash + 1);
			model = models.find(m => m.providers?.some(p => p.providerId === provider && (p.modelName === modelName || p.modelName.endsWith(`/${modelName}`))));
			const providerInfo = model?.providers?.find(p => p.providerId === provider);
			providerLabel = providerInfo ? providerInfo.providerId : undefined;
			prompt = providerInfo?.pricing?.prompt ?? model?.pricing?.prompt;
			completion = providerInfo?.pricing?.completion ?? model?.pricing?.completion;
		} else {
			model = models.find(m => m.id === selectedId || m.name === selectedId);
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
	} = usePlayground();

	const handleModelChange = (modelId: string) => {
		updateColumn(column.id, { modelId });
	};

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
		const inputValue = column.synced ? sharedInput : column.input;
		if (!inputValue.trim()) return;

		setIsSubmitting(true);

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
	const canMoveLeft = columnIndex > 0;
	const canMoveRight = columnIndex < columns.length - 1;
	const canRemove = columns.length > 1;

	return (
        <div className="h-full rounded-md border flex flex-col min-h-0">
            <div className="h-full w-full rounded-b-md min-h-0">
                <div
                    id={`scroll-container-${column.id}_${columnIndex}`}
                    className="flex flex-col flex-no-wrap h-full min-h-0"
                    style={{ overflowAnchor: 'none' }}
                >
					{/* Column header */}
					<div className="sticky top-0 z-10 flex-shrink-0 min-w-0 min-h-0">
						<div className="flex items-center backdrop-blur justify-between m-1 py-2 pl-3 pr-2">
							<div className="flex-1 min-w-0">
								<div className="flex flex-col flex-1">
									<div className="relative grid gap-2">
										<ModelSelector
											selectedModelId={column.modelId}
											setSelectedModelId={handleModelChange}
											className="inline-flex rounded-md py-0.5 px-3 items-center bg-background border font-mono text-foreground leading-6 hover:bg-muted transition-colors ease disabled:opacity-60 disabled:cursor-not-allowed justify-between w-full truncate max-w-[288px] h-[32px]"
											isUserAuthenticated={!!user?.id}
										/>
									</div>
								</div>
							</div>
							

							<div className="flex items-center ml-1">
								<div className="flex items-center">
									{/* Sync badge */}
									{column.synced && (
										<div className="items-center hidden h-6 px-3 mx-2 text-sm bg-secondary text-secondary-foreground rounded-full lg:flex text-md">
											Synced
										</div>
									)}

									{/* Model Configuration button */}
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="submit"
												aria-label="Model Settings"
												className="button_base__IZQUR reset_reset__sz7UJ button_button__dyHAB reset_reset__sz7UJ geist-new-themed geist-new-tertiary geist-new-tertiary-fill button_tertiary__t8MGO button_shape__4NO5k button_small__BoUqH button_invert__WPMQW"
												style={{ "--geist-icon-size": "16px" } as React.CSSProperties}
											>
												<span className="button_content__eYZtX button_flex___f_3o">
													<span className="flex p-2 rounded-md pointer-events-none">
														<Settings className="w-4 h-4" />
													</span>
												</span>
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-80">
											<div className="p-4 space-y-4">
												<div className="font-semibold text-sm">Model Configuration</div>
												<div className="space-y-3">
													<div className="grid gap-2">
                                                        <Input
															id="maxTokens"
															type="number"
															value={column.config.maxOutputTokens}
                                                            onChange={(e) => handleConfigChange({ maxOutputTokens: Number.parseInt(e.target.value) || 1024 })}
															className="h-8"
														/>
													</div>
												</div>
											</div>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>

								{/* Add Column button */}
								<Button
									variant={"ghost"}
									onClick={addColumn}
								>
											<Plus className="w-4 h-4" />
								</Button>

                                <button
                                    type="button"
									onClick={() => toggleColumnSync(column.id)}
									className="w-full flex items-center px-2 py-1.5 text-sm hover:bg-muted rounded text-left"
								>
									<Link2 className="w-4 h-4 mr-2" />
									{column.synced ? "Unsync Chat" : "Sync Chat"}
								</button>
								{/* Menu button for more options */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="submit"
											aria-label="Add Model"
											className="button_base__IZQUR reset_reset__sz7UJ button_button__dyHAB reset_reset__sz7UJ geist-new-themed geist-new-tertiary geist-new-tertiary-fill button_tertiary__t8MGO button_shape__4NO5k button_small__BoUqH button_invert__WPMQW"
											style={{ "--geist-icon-size": "16px" } as React.CSSProperties}
										>
											<span className="button_content__eYZtX button_flex___f_3o button_center__bCjE5">
												<span className="flex p-2 rounded-md pointer-events-none">
													<MoreHorizontal className="w-4 h-4" />
												</span>
											</span>
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">

                                        <button
                                            type="button"
											onClick={() => clearColumn(column.id)}
											className="w-full flex items-center px-2 py-1.5 text-sm hover:bg-muted rounded text-left"
										>
											<RotateCcw className="w-4 h-4 mr-2" />
											Clear Chat
										</button>
										<Separator className="my-1" />
										<DropdownMenuItem
											onClick={() => moveColumnLeft(column.id)}
											disabled={!canMoveLeft}
										>
											<ChevronLeft className="w-4 h-4 mr-2" />
											Scroll Left
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => moveColumnRight(column.id)}
											disabled={!canMoveRight}
										>
											<ChevronRight className="w-4 h-4 mr-2" />
											Scroll Right
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => removeColumn(column.id)}
											disabled={!canRemove}
											className="text-destructive"
										>
											<Trash2 className="w-4 h-4 mr-2" />
											Delete Column
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</div>
					<Separator />

					{/* Messages content area */}
                    <div className="flex-1 min-w-0 min-h-0">
                        <div
                            id={`scroll-container-inner-${column.id}_${columnIndex}`}
                            className="scrolling-touch scrolling-gpu h-full w-full relative overscroll-y-contain"
                        >
						{column.messages.length > 0 ? (
								<Conversation
									messages={column.messages.map(msg => ({
										...msg,
										model: column.modelId,
									}))}
									status={isSubmitting ? "streaming" : "ready"}
                                    scrollButtonBottomClass="bottom-2"
									onDelete={(id) => {
										updateColumn(column.id, {
											messages: column.messages.filter(msg => msg.id !== id)
										});
									}}
									onEdit={(id, newText) => {
										updateColumn(column.id, {
											messages: column.messages.map(msg =>
												msg.id === id
													? { ...msg, content: newText, parts: [{ type: "text", text: newText }] }
													: msg
											)
										});
									}}
									onReload={() => {
										// Find the last user message and resend
                                        const lastUserMessage = [...column.messages].reverse().find(msg => msg.role === "user");
                                        if (lastUserMessage?.content) {
											// Remove messages after the last user message
											const messagesReversed = [...column.messages].reverse();
											const lastUserIndexFromEnd = messagesReversed.findIndex(msg => msg.role === "user");
											const lastUserIndex = column.messages.length - 1 - lastUserIndexFromEnd;
											const messagesUpToLastUser = column.messages.slice(0, lastUserIndex + 1);
											updateColumn(column.id, { messages: messagesUpToLastUser });

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
							<div className="flex items-center justify-center size-full px-4">
								<div className="w-full max-w-xl border rounded-lg shadow-xs bg-white dark:bg-black">
									<div className="p-5 text-sm">
										<div className="flex items-center gap-2">
											<div className="size-4 mr-0.5 text-zinc-600 dark:text-zinc-400">
												<svg data-testid="geist-icon" height="16" strokeLinejoin="round" viewBox="0 0 16 16" width="16" style={{ color: "currentcolor" }}>
													<title>Model icon</title>
													<path d="M14.9449 6.54871C15.3128 5.45919 15.1861 4.26567 14.5978 3.27464C13.7131 1.75461 11.9345 0.972595 10.1974 1.3406C9.42464 0.481584 8.3144 -0.00692594 7.15045 7.42132e-05C5.37487 -0.00392587 3.79946 1.1241 3.2532 2.79113C2.11256 3.02164 1.12799 3.72615 0.551837 4.72468C-0.339497 6.24071 -0.1363 8.15175 1.05451 9.45178C0.686626 10.5413 0.813308 11.7348 1.40162 12.7258C2.28637 14.2459 4.06498 15.0279 5.80204 14.6599C6.5743 15.5189 7.68504 16.0074 8.849 15.9999C10.6256 16.0044 12.2015 14.8754 12.7478 13.2069C13.8884 12.9764 14.873 12.2718 15.4491 11.2733C16.3394 9.75728 16.1357 7.84774 14.9454 6.54771L14.9449 6.54871ZM8.85001 14.9544C8.13907 14.9554 7.45043 14.7099 6.90468 14.2604C6.92951 14.2474 6.97259 14.2239 7.00046 14.2069L10.2293 12.3668C10.3945 12.2743 10.4959 12.1008 10.4949 11.9133V7.42173L11.8595 8.19925C11.8742 8.20625 11.8838 8.22025 11.8858 8.23625V11.9558C11.8838 13.6099 10.5263 14.9509 8.85001 14.9544ZM2.32133 12.2028C1.9651 11.5958 1.8369 10.8843 1.95902 10.1938C1.98284 10.2078 2.02489 10.2333 2.05479 10.2503L5.28366 12.0903C5.44733 12.1848 5.65003 12.1848 5.81421 12.0903L9.75604 9.84429V11.3993C9.75705 11.4153 9.74945 11.4308 9.73678 11.4408L6.47295 13.3004C5.01915 14.1264 3.1625 13.6354 2.32184 12.2028H2.32133ZM1.47155 5.24819C1.82626 4.64017 2.38619 4.17516 3.05305 3.93366C3.05305 3.96116 3.05152 4.00966 3.05152 4.04366V7.72424C3.05051 7.91124 3.15186 8.08475 3.31654 8.17725L7.25838 10.4228L5.89376 11.2003C5.88008 11.2093 5.86285 11.2108 5.84765 11.2043L2.58331 9.34327C1.13255 8.51426 0.63494 6.68272 1.47104 5.24869L1.47155 5.24819ZM12.6834 7.82274L8.74157 5.57669L10.1062 4.79968C10.1199 4.79068 10.1371 4.78918 10.1523 4.79568L13.4166 6.65522C14.8699 7.48373 15.3681 9.31827 14.5284 10.7523C14.1732 11.3593 13.6138 11.8243 12.9474 12.0663V8.27575C12.9489 8.08875 12.8481 7.91574 12.6839 7.82274H12.6834ZM14.0414 5.8057C14.0176 5.7912 13.9756 5.7662 13.9457 5.7492L10.7168 3.90916C10.5531 3.81466 10.3504 3.81466 10.1863 3.90916L6.24442 6.15521V4.60017C6.2434 4.58417 6.251 4.56867 6.26367 4.55867L9.52751 2.70063C10.9813 1.87311 12.84 2.36563 13.6781 3.80066C14.0323 4.40667 14.1605 5.11618 14.0404 5.8057H14.0414ZM5.50257 8.57726L4.13744 7.79974C4.12275 7.79274 4.11312 7.77874 4.11109 7.76274V4.04316C4.11211 2.38713 5.47368 1.0451 7.15197 1.0461C7.86189 1.0461 8.54902 1.2921 9.09476 1.74011C9.06993 1.75311 9.02737 1.77661 8.99899 1.79361L5.77012 3.63365C5.60493 3.72615 5.50358 3.89916 5.50459 4.08666L5.50257 8.57626V8.57726ZM6.24391 7.00022L7.99972 5.9997L9.75553 6.99972V9.00027L7.99972 10.0003L6.24391 9.00027V7.00022Z" fill="currentColor" />
												</svg>
											</div>
											<div className="space-x-1">
												<span className="text-zinc-800 dark:text-zinc-200 font-medium">
													{selectedModel?.name ?? column.modelId}
												</span>
												{selectedProviderLabel && (
													<span className="text-zinc-600 dark:text-zinc-400">· {selectedProviderLabel}</span>
												)}
											</div>
										</div>

										{isModelsLoading ? (
											<div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Loading model details…</div>
										) : modelsError ? (
											<div className="mt-3 text-xs text-red-500">{modelsError}</div>
										) : (
											<>
												<div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
													{selectedModel?.description || "Start a conversation to test this model."}
												</div>
												<div className="mt-3 flex flex-wrap gap-2 text-[11px]">
													<span className="rounded border px-2 py-1">Context: {selectedModel?.context_length ?? "-"} tokens</span>
													<span className="rounded border px-2 py-1">Input: {promptPrice}</span>
													<span className="rounded border px-2 py-1">Output: {completionPrice}</span>
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
					<div className="sticky bottom-0 flex-shrink-0 min-w-0 min-h-0">
						<div className="p-3 pr-2.5 bg-background-200 border-t flex items-center gap-2">
							<form className="relative flex items-center w-full">
								<textarea
									placeholder={column.synced ? "Type a synced message..." : "Type your message…"}
									value={currentInput}
									onChange={(e) => {
										handleInputChange(e.target.value);
										// Auto-resize textarea
										const target = e.target as HTMLTextAreaElement;
										target.style.height = 'auto';
										target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
									}}
									className="rounded-md min-h-[38px] flex-1 max-h-[120px] text-sm bg-background-100 border resize-none overflow-y-auto focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-0 focus:outline-none pr-9 pl-9 py-2"
									spellCheck="false"
									rows={1}
									style={{
										fontFamily: "var(--font-geist-sans)",
										height: "38px",
										lineHeight: "1.5"
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleSend();
										}
									}}
								/>
								<div className="absolute inline-flex items-center justify-end bottom-[3px] right-1">
									<button
										type="submit"
										aria-label="Send Message"
										onClick={handleSend}
										disabled={isSubmitting || !currentInput.trim()}
										className="button_base__IZQUR reset_reset__sz7UJ button_button__dyHAB reset_reset__sz7UJ geist-new-themed geist-new-tertiary geist-new-tertiary-fill button_tertiary__t8MGO button_shape__4NO5k button_small__BoUqH button_invert__WPMQW"
										data-geist-button=""
										data-prefix="false"
										data-suffix="false"
										data-version="v1"
										style={{ "--geist-icon-size": "16px" } as React.CSSProperties}
									>
										<span className="button_content__eYZtX button_flex___f_3o">
											<span className="flex p-2 rounded-md pointer-events-none">
												{/* Send icon placeholder */}
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