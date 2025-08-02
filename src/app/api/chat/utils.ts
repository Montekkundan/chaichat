import type { UIMessage as MessageAISDK } from "ai";

/**
 * Clean messages when switching between agents with different tool capabilities.
 * This removes tool invocations and tool-related content from messages when tools are not available
 * to prevent OpenAI API errors.
 */
export function cleanMessagesForTools(
	messages: MessageAISDK[],
	hasTools: boolean,
): MessageAISDK[] {
	// If tools are available, return messages as-is
	if (hasTools) {
		return messages;
	}

	// If no tools available, clean all tool-related content
	const cleanedMessages = messages
		.map((message) => {
			// Skip tool messages entirely when no tools are available
			// Note: Using type assertion since AI SDK types might not include 'tool' role
			if ((message as { role: string }).role === "tool") {
				return null;
			}

			// For assistant messages, clean tool invocations and tool calls
			if (message.role === "assistant") {
				const cleanedMessage: MessageAISDK = { ...message };

				// Clean parts array (remove tool-related parts)
				if (message.parts && Array.isArray(message.parts)) {
					const filteredParts = message.parts.filter((part: any) => {
						if (part && typeof part === "object" && part.type) {
							// Remove tool-related parts using v5 patterns
							const isToolPart =
								part.type === "tool-call" ||
								part.type === "tool-result" ||
								part.type === "dynamic-tool" ||
								part.type.startsWith("tool-"); // v5 tool parts use pattern "tool-{toolName}"
							return !isToolPart;
						}
						return true;
					});

					// Extract text parts
					const textParts = filteredParts.filter(
						(part: any) => part && part.type === "text",
					);

					if (textParts.length > 0) {
						// Keep only text parts
						cleanedMessage.parts = textParts;
					} else if (filteredParts.length === 0) {
						// If no content remains after filtering, provide fallback text part
						cleanedMessage.parts = [
							{ type: "text", text: "[Assistant response]" },
						];
					} else {
						// Keep the filtered parts
						cleanedMessage.parts = filteredParts;
					}
				} else {
					// Ensure there's at least a text part
					cleanedMessage.parts = [
						{ type: "text", text: "[Assistant response]" },
					];
				}

				return cleanedMessage;
			}

			// For user messages, clean any tool-related content from parts array
			if (message.role === "user" && message.parts && Array.isArray(message.parts)) {
				const filteredParts = message.parts.filter((part: any) => {
					if (part && typeof part === "object" && part.type) {
						const isToolPart =
							part.type === "tool-call" ||
							part.type === "tool-result" ||
							part.type === "dynamic-tool" ||
							part.type.startsWith("tool-");
						return !isToolPart;
					}
					return true;
				});

				if (filteredParts.length !== message.parts.length) {
					return {
						...message,
						parts:
							filteredParts.length > 0 
								? filteredParts 
								: [{ type: "text", text: "User message" }],
					};
				}
			}

			return message;
		})
		.filter((message): message is MessageAISDK => message !== null);

	return cleanedMessages;
}

/**
 * Check if a message contains tool-related content
 */
export function messageHasToolContent(message: MessageAISDK): boolean {
	return !!(
		(message as { role: string }).role === "tool" ||
		(message.parts && Array.isArray(message.parts) &&
			message.parts.some((part: any) =>
				part &&
				typeof part === "object" &&
				part.type &&
				(part.type === "tool-call" ||
					part.type === "tool-result" ||
					part.type === "dynamic-tool" ||
					part.type.startsWith("tool-")),
			))
	);
}
