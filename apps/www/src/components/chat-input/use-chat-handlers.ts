import type { UIMessage } from "@ai-sdk/react";
import type { User } from "@clerk/nextjs/server";
import { useCallback } from "react";
import { useChatDraft } from "~/hooks/use-chat-draft";

type UseChatHandlersProps = {
	messages: UIMessage[];
	setMessages: (
		messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
	) => void;
	setInput: (input: string) => void;
	setSelectedModel: (model: string) => void;
	selectedModel: string;
	chatId: string | null;
	// updateChatModel: (chatId: string, model: string) => Promise<void>
	user: User | null;
};

export function useChatHandlers({
	messages,
	setMessages,
	setInput,
	setSelectedModel,
	selectedModel,
	chatId,
	// updateChatModel,
	user,
}: UseChatHandlersProps) {
	const { setDraftValue } = useChatDraft(chatId);

	const handleInputChange = useCallback(
		(value: string) => {
			setInput(value);
			setDraftValue(value);
		},
		[setInput, setDraftValue],
	);

	const handleModelChange = useCallback(
		async (model: string) => {
			// If chat not yet created just update local state
			if (!chatId) {
				setSelectedModel(model);
				return;
			}

			const oldModel = selectedModel;

			setSelectedModel(model);
		},
		[chatId, selectedModel, setSelectedModel],
	);

	const handleDelete = useCallback(
		(id: string) => {
			setMessages(messages.filter((message) => message.id !== id));
		},
		[messages, setMessages],
	);

	const handleEdit = useCallback(
		(id: string, newText: string) => {
			setMessages(
				messages.map((message) =>
					message.id === id
						? { ...message, parts: [{ type: "text", text: newText }] }
						: message,
				),
			);
		},
		[messages, setMessages],
	);

	return {
		handleInputChange,
		handleModelChange,
		handleDelete,
		handleEdit,
	};
}
