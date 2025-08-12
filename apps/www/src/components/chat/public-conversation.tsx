"use client";

import { Conversation } from "~/components/chat/conversation";

import type { UIMessage as MessageType } from "@ai-sdk/react";

type MessageWithModel = Omit<MessageType, "role"> & {
	role: "user" | "assistant" | "system";
	model?: string;
};

type Props = {
	messages: MessageWithModel[];
};

export function PublicConversation({ messages }: Props) {
	const noop = () => {};
	return (
		<Conversation
			messages={messages}
			status="ready"
			onDelete={noop}
			onEdit={noop}
			onReload={noop}
		/>
	);
}
