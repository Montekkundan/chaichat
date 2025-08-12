import type { JSONValue, UIMessage as MessageAISDK } from "ai";

type UIPartMinimal = { type: string; text?: string };
function isUIPartMinimal(value: unknown): value is UIPartMinimal {
	return (
		!!value &&
		typeof value === "object" &&
		// biome-ignore lint/suspicious/noExplicitAny: runtime shape check for foreign type
		typeof (value as any).type === "string"
	);
}

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
					const filteredParts = message.parts.filter((part: unknown) => {
						if (isUIPartMinimal(part)) {
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
						(part) => isUIPartMinimal(part) && part.type === "text",
					) as UIPartMinimal[];

					if (textParts.length > 0) {
						// Keep only text parts
						cleanedMessage.parts =
							textParts as unknown as MessageAISDK["parts"];
					} else if (filteredParts.length === 0) {
						// If no content remains after filtering, provide fallback text part
						cleanedMessage.parts = [
							{ type: "text", text: "[Assistant response]" },
						];
					} else {
						// Keep the filtered parts
						cleanedMessage.parts =
							filteredParts as unknown as MessageAISDK["parts"];
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
			if (
				message.role === "user" &&
				message.parts &&
				Array.isArray(message.parts)
			) {
				const filteredParts = message.parts.filter((part: unknown) => {
					if (isUIPartMinimal(part)) {
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
								? (filteredParts as unknown as MessageAISDK["parts"])
								: ([
										{ type: "text", text: "User message" },
									] as unknown as MessageAISDK["parts"]),
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
		(message.parts &&
			Array.isArray(message.parts) &&
			message.parts.some(
				(part: unknown) =>
					isUIPartMinimal(part) &&
					(part.type === "tool-call" ||
						part.type === "tool-result" ||
						part.type === "dynamic-tool" ||
						part.type.startsWith("tool-")),
			))
	);
}

// --- Shared helpers used by the API route ---

export function parseProviderAndModel(modelId: string): {
	providerId?: string;
	modelName: string;
} {
	if (!modelId.includes("/")) {
		return { modelName: modelId };
	}
	const firstSlash = modelId.indexOf("/");
	const providerId = modelId.slice(0, firstSlash);
	const modelName = modelId.slice(firstSlash + 1);
	return { providerId, modelName };
}

export function isOpenAIReasoningModel(modelId: string): boolean {
	const { providerId, modelName } = parseProviderAndModel(modelId);
	if (providerId && providerId !== "openai") return false;
	if (!modelName) return false;
	return (
		modelName === "o1" ||
		modelName.startsWith("o1-") ||
		modelName === "o3" ||
		modelName.startsWith("o3-") ||
		modelName === "o4-mini" ||
    modelName.startsWith("o4-mini-") ||
    modelName === "gpt-5" ||
    modelName.startsWith("gpt-5")
	);
}

export function isGoogleModel(modelId: string): boolean {
	const { providerId } = parseProviderAndModel(modelId);
	const rootProvider = providerId || modelId.split("/")[0];
	return /^(google|gemini)$/i.test(rootProvider ?? "");
}

export function isOpenAIProvider(modelId: string): boolean {
  const { providerId } = parseProviderAndModel(modelId);
  const rootProvider = providerId || modelId.split("/")[0];
  return /^(openai|azure-openai)$/i.test(rootProvider ?? "");
}

export function combineTextFromUIMessages(uiMessages: MessageAISDK[]): string {
	try {
		// Prefer parts-based text (AI SDK v5 UI messages), but gracefully
		// fall back to legacy `content` string if parts are not present.
		const fromParts = uiMessages
			?.map((m) => {
				const parts = (m as { parts?: unknown }).parts as
					| UIPartMinimal[]
					| undefined;
				if (!Array.isArray(parts)) return "";
				const text = parts
					.filter((p) => isUIPartMinimal(p) && p.type === "text")
					.map((p) => p.text ?? "")
					.join("");
				return text;
			})
			.filter((s) => s && s.length > 0)
			.join("\n\n");

		if (fromParts && fromParts.length > 0) return fromParts;

		// Fallback: check legacy `content` field on messages
		const fromContent = uiMessages
			?.map((m) => {
				const content = (m as unknown as { content?: unknown }).content;
				return typeof content === "string" ? content : "";
			})
			.filter((s) => s && s.length > 0)
			.join("\n\n");

		return fromContent || "";
	} catch {
		return "";
	}
}

/**
 * Remove messages with empty content. Some providers (e.g., Anthropic) reject
 * any message with empty content except the optional final assistant stub.
 * This runs after `convertToModelMessages` so content is normalized.
 */
export function removeEmptyModelMessages<T extends { role: string; content: unknown }>(
  messages: T[],
): T[] {
  if (!Array.isArray(messages)) return [];

  const isNonEmpty = (content: unknown): boolean => {
    if (content == null) return false;
    if (typeof content === "string") return content.trim().length > 0;
    if (Array.isArray(content)) {
      // Heuristic: keep if any text part has non-empty text
      for (const part of content as unknown[]) {
        if (
          part &&
          typeof part === "object" &&
          // biome-ignore lint/suspicious/noExplicitAny: shape from provider
          (part as any).type === "text" &&
          typeof (part as { text?: unknown }).text === "string" &&
          ((part as { text: string }).text.trim().length > 0)
        ) {
          return true;
        }
      }
      return false;
    }
    if (typeof content === "object") {
      // Try common single-part shape { type: 'text', text: string }
      const maybeText = (content as { text?: unknown }).text;
      if (typeof maybeText === "string") return maybeText.trim().length > 0;
      // Unknown object content: assume non-empty to avoid dropping valid structured content
      return true;
    }
    // Primitives other than string are treated as empty
    return false;
  };

  const filtered: T[] = messages.filter((m) => isNonEmpty(m?.content));

  // Special-case: if the last message is assistant and empty, drop it
  if (filtered.length > 0) {
    const last = filtered[filtered.length - 1] as T | undefined;
    if (last) {
      const lastIsEmpty = !isNonEmpty((last as { content: unknown }).content);
      if (lastIsEmpty && (last as { role: string }).role === "assistant") {
        filtered.pop();
      }
    }
  }

  return filtered;
}

export type OpenAIConfig = {
	reasoningEffort?: "minimal" | "low" | "medium" | "high";
	reasoningSummary?: "auto" | "detailed";
	textVerbosity?: "low" | "medium" | "high";
	serviceTier?: "auto" | "flex" | "priority";
	parallelToolCalls?: boolean;
	store?: boolean;
	strictJsonSchema?: boolean;
	maxCompletionTokens?: number;
	user?: string;
	metadata?: Record<string, string>;
};

export type GoogleConfig = {
	cachedContent?: string;
	structuredOutputs?: boolean;
	safetySettings?: Array<{ category: string; threshold: string }>;
	responseModalities?: string[];
	// Some gateways/providers prefer explicit mime type for text output
	responseMimeType?: string;
	thinkingConfig?: { thinkingBudget?: number; includeThoughts?: boolean };
};

export function buildProviderOptions(params: {
	modelId: string;
	isOAIReasoning: boolean;
	openai?: OpenAIConfig;
	google?: GoogleConfig;
	maxOutputTokens?: number;
	system?: string;
}): Record<string, Record<string, JSONValue>> | undefined {
	const { modelId, isOAIReasoning, openai, google, maxOutputTokens, system } =
		params;
	const { providerId } = parseProviderAndModel(modelId);
	const rootProvider = providerId || modelId.split("/")[0];
	const options: Record<string, Record<string, JSONValue>> = {};

	if (/openai/i.test(rootProvider ?? "")) {
		const openaiOpts: Record<string, JSONValue> = {};
		if (openai) {
			const {
				reasoningEffort,
				reasoningSummary,
				textVerbosity,
				serviceTier,
				parallelToolCalls,
				store,
				strictJsonSchema,
				maxCompletionTokens,
				user,
				metadata,
			} = openai;
			const mc = isOAIReasoning
				? (maxCompletionTokens ?? maxOutputTokens)
				: maxCompletionTokens;
			if (typeof mc === "number") openaiOpts.maxCompletionTokens = mc;
			if (typeof reasoningEffort === "string")
				openaiOpts.reasoningEffort = reasoningEffort as JSONValue;
			if (typeof reasoningSummary === "string")
				openaiOpts.reasoningSummary = reasoningSummary as JSONValue;
			if (typeof textVerbosity === "string")
				openaiOpts.textVerbosity = textVerbosity as JSONValue;
			if (typeof serviceTier === "string")
				openaiOpts.serviceTier = serviceTier as JSONValue;
			if (typeof parallelToolCalls === "boolean")
				openaiOpts.parallelToolCalls = parallelToolCalls;
			if (typeof store === "boolean") openaiOpts.store = store;
			if (typeof strictJsonSchema === "boolean")
				openaiOpts.strictJsonSchema = strictJsonSchema;
			if (typeof user === "string" && user.length > 0) openaiOpts.user = user;
			if (metadata && Object.keys(metadata).length > 0)
				openaiOpts.metadata = metadata as unknown as JSONValue;
		}
		if (isOAIReasoning) {
			if (openaiOpts.reasoningSummary === undefined) {
				openaiOpts.reasoningSummary = "detailed";
			}
			if (openaiOpts.textVerbosity === undefined) {
				openaiOpts.textVerbosity = "high";
			}
		}
		if (Object.keys(openaiOpts).length > 0) options.openai = openaiOpts;
	}

	if (/^(google|gemini)$/i.test(rootProvider ?? "")) {
		const googleOpts: Record<string, JSONValue> = {};
		if (google) {
			const {
				cachedContent,
				structuredOutputs,
				safetySettings,
				responseModalities,
				responseMimeType,
				thinkingConfig,
			} = google;
			if (typeof cachedContent === "string" && cachedContent.length > 0)
				googleOpts.cachedContent = cachedContent;
			if (typeof structuredOutputs === "boolean")
				googleOpts.structuredOutputs = structuredOutputs;
			if (Array.isArray(safetySettings) && safetySettings.length > 0)
				googleOpts.safetySettings = safetySettings as unknown as JSONValue;
			if (Array.isArray(responseModalities) && responseModalities.length > 0)
				googleOpts.responseModalities =
					responseModalities as unknown as JSONValue;
			// Prefer explicit text mime type when asking for TEXT modality to avoid empty streams
			const wantsText =
				Array.isArray(responseModalities) &&
				responseModalities.some(
					(m) => typeof m === "string" && m.toUpperCase() === "TEXT",
				);
			const mime = responseMimeType || (wantsText ? "text/plain" : undefined);
			if (mime) googleOpts.responseMimeType = mime;
			if (
				thinkingConfig &&
				(typeof thinkingConfig.thinkingBudget === "number" ||
					typeof thinkingConfig.includeThoughts === "boolean")
			)
				googleOpts.thinkingConfig = thinkingConfig as unknown as JSONValue;
		}
		if (typeof system === "string" && system.length > 0) {
			googleOpts.systemInstruction = system;
		}
		if (Object.keys(googleOpts).length > 0) options.google = googleOpts;
	}

	return Object.keys(options).length ? options : undefined;
}
