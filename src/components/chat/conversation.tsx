import type { UIMessage as MessageType } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import {
	Conversation as AIConversation,
	ConversationContent,
	ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Loader } from "~/components/ai-elements/loader";
import {
	Message,
	MessageContent,
} from "~/components/ai-elements/message";
import { Response } from "~/components/ai-elements/response";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "../ai-elements/reasoning";
import { Actions, Action } from "~/components/ai-elements/actions";
import ModelBadge from "~/components/ai-elements/model-badge";
import { Check, Copy } from "lucide-react";
import { cn } from "~/lib/utils";
import { useStickToBottomContext } from "use-stick-to-bottom";

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

  // Only show the inline loader for the latest assistant message, so that we dont show it for messages that have/had error
  const latestMessageId = messages.length > 0 ? messages[messages.length - 1]?.id ?? null : null;

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
						const isAssistant = message.role === 'assistant';
						const hasRenderableContent = Array.isArray(message.parts)
							? message.parts.some((part) => {
								if (part.type === 'text') return (part.text || '').trim().length > 0;
								if (part.type === 'reasoning') return (part.text || '').trim().length > 0;
								return true;
							})
							: false;
            const shouldShowInlineLoader =
              isAssistant &&
              (status === 'submitted' || status === 'streaming') &&
              message.id === latestMessageId &&
              !hasRenderableContent;

						return (
							<Message from={message.role} key={message.id}>
								<MessageContent>
									{shouldShowInlineLoader ? (
										<Loader />
									) : (
										(() => {
											const parts = Array.isArray(message.parts) ? message.parts : [];
                                            const reasoningParts = parts.filter((p) => p.type === 'reasoning');
											const textParts = parts.filter((p) => p.type === 'text');
											return (
												<>
                                                    {reasoningParts.map((part, i) => {
                                                        let text: string | undefined;
                                                        if (typeof part === 'object' && part !== null && 'text' in part) {
                                                            const maybe = (part as unknown as { text?: unknown }).text;
                                                            if (typeof maybe === 'string') text = maybe;
                                                        }
                                                        if (!text || text.trim().length === 0) return null;
                                                        return (
                                                            <Reasoning
                                                                key={`${message.id}-reasoning-${i}`}
                                                                className="w-full"
                                                                isStreaming={status === 'streaming'}
                                                                defaultOpen={status === 'streaming'}
                                                            >
                                                                <ReasoningTrigger />
                                                                <ReasoningContent>{text}</ReasoningContent>
                                                            </Reasoning>
                                                        );
                                                    })}
													{textParts.map((part, i) => {
														const key = `${message.id}-text-${i}`;
														const isCopied = copiedKey === key;
														const isLastBlock = i === textParts.length - 1;
														const showActions =
															isLastBlock &&
															message.role === 'assistant' &&
															status !== 'streaming'
														return (
															<div key={key} className="w-full">
																<Response>{part.text}</Response>
																{showActions && (
																	<Actions className="mt-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                                        {message.role === 'assistant' && typeof (message as { model?: string } | undefined)?.model === 'string' && (
																			<div className="mr-2">
                                                                                <ModelBadge
                                                                                  modelId={(message as { model?: string }).model}
                                                                                  gateway={(message as { gateway?: "llm-gateway" | "vercel-ai-gateway" }).gateway || gateway}
                                                                                />
																			</div>
																		)}
																		<Action
																			tooltip="Copy"
																			label="Copy"
																			onClick={() => handleCopy(part.text, key)}
																			aria-label={isCopied ? "Copied" : "Copy to clipboard"}
																			disabled={isCopied}
																		>
																			<div
																				className={cn(
																					"transition-all",
																					isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0",
																				)}
																			>
																				<Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
																			</div>
																			<div
																				className={cn(
																					"absolute transition-all",
																					isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100",
																				)}
																			>
																				<Copy size={16} strokeWidth={2} aria-hidden="true" />
																			</div>
																		</Action>
																	</Actions>
																)}
															</div>
														);
													})}
												</>
											);
										})()
									)}
								</MessageContent>
								{/* User message actions outside the bubble */}
								{message.role === 'user' && (() => {
									const parts = Array.isArray(message.parts) ? message.parts : [];
									const userText = parts
										.filter((p) => p.type === 'text')
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
														isCopied ? "scale-100 opacity-100" : "scale-0 opacity-0",
													)}
												>
													<Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
												</div>
												<div
													className={cn(
														"absolute transition-all",
														isCopied ? "scale-0 opacity-0" : "scale-100 opacity-100",
													)}
												>
													<Copy size={16} strokeWidth={2} aria-hidden="true" />
												</div>
											</Action>
										</Actions>
									);
								})()}
							</Message>
						);
					})}

				</ConversationContent>
				<ConversationScrollButton
					className={`z-20 shadow-sm ${scrollButtonBottomClass}`}
				/>
			</AIConversation>
		</div>
	);
}
