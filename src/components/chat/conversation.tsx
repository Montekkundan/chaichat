import type { UIMessage as MessageType } from "@ai-sdk/react";
import { useRef } from "react";
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

type ConversationProps = {
	messages: (MessageType & {
		model?: string;
		convexId?: string;
		content?: string;
	})[];
	status?: "streaming" | "ready" | "submitted" | "error";
	onDelete: (id: string) => void;
	onEdit: (id: string, newText: string) => void;
	onReload: () => void;
	onBranch?: (messageIndex: number) => void;
	scrollButtonBottomClass?: string;
};

export function Conversation({
	status,
	messages,
	onDelete: _onDelete,
	onEdit: _onEdit,
	onReload: _onReload,
	onBranch: _onBranch,
	scrollButtonBottomClass = "bottom-34",
}: ConversationProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	// status indicates chat lifecycle: 'ready' | 'submitted' | 'streaming' | 'error'

	return (
		<div ref={containerRef} className="relative flex h-full w-full flex-col">
			<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
				<div className="flex h-app-header w-full bg-background lg:hidden lg:h-0" />
				<div className="mask-b-from-4% mask-b-to-100% flex h-app-header w-full bg-background lg:hidden" />
			</div>

			<AIConversation className="relative h-full w-full overflow-y-hidden">
				<ConversationContent className="flex w-full flex-col items-center pt-20 pb-40">
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
							!hasRenderableContent;

						return (
							<Message from={message.role} key={message.id}>
								<MessageContent>
									{shouldShowInlineLoader ? (
										<Loader />
									) : (
										message.parts.map((part, i) => {
											switch (part.type) {
												case 'text':
													return (
														<Response key={`${message.id}-${i}`}>
															{part.text}
														</Response>
													);
												case 'reasoning':
													return (
														<Reasoning
															key={`${message.id}-${i}`}
															className="w-full"
															isStreaming={status === 'streaming'}
														>
															<ReasoningTrigger />
															<ReasoningContent>{part.text}</ReasoningContent>
														</Reasoning>
													);
											}
										})
									)}
								</MessageContent>
							</Message>
						);
					})}

				</ConversationContent>
				<ConversationScrollButton
					className={`shadow-sm ${scrollButtonBottomClass}`}
				/>
			</AIConversation>
		</div>
	);
}
