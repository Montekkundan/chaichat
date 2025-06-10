"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageAvatar,
	MessageContent,
} from "~/components/prompt-kit/message";

export type MessageListMessage = {
	id: string;
	role: "user" | "assistant";
	content: string | string[];
};

import {
	ChatContainerRoot, ChatContainerContent,
	ChatContainerScrollAnchor
} from "~/components/prompt-kit/chat-container"
import { ScrollButton } from "~/components/prompt-kit/scroll-button"

type MessageListProps = {
	messages: MessageListMessage[];
	showAvatar?: boolean;
};

export function MessageList({
	messages,
	showAvatar = false,
}: MessageListProps) {
	return (
		<div className="">
			<ChatContainerRoot className="h-full">
				<ChatContainerContent className="bg-red-500">
					<div className="">
						<div>Message 1</div>
						{messages.map((msg) => {
							const content = Array.isArray(msg.content) ? msg.content.join("") : msg.content;
							const isUser = msg.role === "user";
							return (
								<div
									key={msg.id}
									className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`prose whitespace-normal break-words rounded-lg p-2
											${isUser
												? "bg-secondary text-foreground"
												: "bg-secondary text-foreground"
											}`}
									>
										{content}
									</div>
								</div>
							);
						})}
					</div>
				</ChatContainerContent>
				<ChatContainerScrollAnchor />
				<div className="absolute right-4 bottom-4">
					<ScrollButton className="shadow-sm" />
				</div>
			</ChatContainerRoot>
		</div>
	);
}

export function MessageWithActions({
	message,
	showAvatar,
}: {
	message: MessageListMessage;
	showAvatar: boolean;
}) {
	const [copied, setCopied] = useState(false);

	const content = Array.isArray(message.content)
		? message.content.join("")
		: message.content;

	const handleCopy = () => {
		navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (message.role === "user") {
		return (
			<Message className="justify-end">
				<MessageContent>{content}</MessageContent>
			</Message>
		);
	}

	// assistant message
	return (
		<Message className="justify-start">
			{showAvatar && (
				<MessageAvatar src="/avatars/ai.png" alt="AI" fallback="AI" />
			)}
			<div className="flex w-full flex-col gap-2">
				<div className="flex flex-row items-end gap-2">
					<div className="flex-1">
						<MessageContent markdown className="bg-transparent p-0">
							{content}
						</MessageContent>
					</div>
				</div>
				<div className="flex flex-row gap-2">
					<MessageActions className="self-start">
						<MessageAction tooltip="Copy to clipboard">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-full"
								onClick={handleCopy}
							>
								<Copy className={`size-4 ${copied ? "text-green-500" : ""}`} />
							</Button>
						</MessageAction>
					</MessageActions>
				</div>
			</div>
		</Message>
	);
}