"use client";

import { type UIMessage, useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { getAllKeys } from "~/lib/local-keys";
import {
	getSelectedModel,
	setSelectedModel as saveSelectedModel,
} from "~/lib/local-model-storage";
import { useCache } from "~/lib/providers/cache-provider";
import { userSessionManager } from "~/lib/user-session-manager";

type UploadedFile = {
	name: string;
	url: string;
	contentType: string;
	size: number;
};

// Extended message type with Convex ID for persistence
type ExtendedMessage = UIMessage & {
	convexId?: string;
	parentMessageId?: string;
	model?: string;
	_creationTime?: number;
};

interface MessagesContextType {
	messages: ExtendedMessage[];
	input: string;
	setInput: (input: string) => void;
	sendMessage: (
		message: string,
		attachments?: UploadedFile[],
		search?: boolean,
	) => void;
	isSubmitting: boolean;
	selectedModel: string;
	setSelectedModel: (model: string) => void;
	status: "ready" | "streaming" | "submitted" | "error";
	quotaExceeded: boolean;
	rateLimited: boolean;
	createNewChat: (initialMessage: string, model: string) => Promise<string>;
	regenerate: (messageId: string, model: string) => void;
	stop: () => void;
}

const MessagesContext = createContext<MessagesContextType | null>(null);

export function useMessages() {
	const context = useContext(MessagesContext);
	if (!context) {
		throw new Error("useMessages must be used within a MessagesProvider");
	}
	return context;
}

interface MessagesProviderProps {
	children: ReactNode;
	chatId?: string | null;
}

// v5 helper - extract text content from parts
const getTextContent = (parts: UIMessage["parts"]) => {
	if (!parts) return "";
	const textParts = parts.filter((part) => part.type === "text");
	return textParts
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("");
};

// v5 helper - create text parts from content
const createTextParts = (content: string): UIMessage["parts"] => [
	{
		type: "text" as const,
		text: content,
	},
];

// v5 helper - create file parts from attachments
const _createFileParts = (attachments: UploadedFile[]) =>
	attachments.map((att) => ({
		type: "file" as const,
		url: att.url,
		mediaType: att.contentType,
		filename: att.name,
	}));

/**
 * MessagesProvider - Manages chat messages, model selection, and AI communication
 * Uses AI SDK v5 with proper BYOK (Bring Your Own Key) support
 */
export function MessagesProvider({ children, chatId }: MessagesProviderProps) {
	const { user } = useUser();
	const cache = useCache();
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedModel, setSelectedModel] = useState(() => {
		// Initialize with saved model from localStorage or fallback to default
		if (typeof window !== "undefined") {
			const savedModel = getSelectedModel();
			if (savedModel?.modelId) {
				return savedModel.modelId;
			}
		}
		return "openai/gpt-4o-mini"; // Default model with provider
	});
	const [quotaExceeded, setQuotaExceeded] = useState(false);
	const [rateLimited, setRateLimited] = useState(false);
	const currentUserId = user?.id ?? userSessionManager.getStorageUserId();

	const selectedModelRef = useRef(selectedModel);
	useEffect(() => {
		selectedModelRef.current = selectedModel;
	}, [selectedModel]);

	// Save selected model to localStorage whenever it changes
	useEffect(() => {
		if (selectedModel && typeof window !== "undefined") {
			// Extract provider from the model string if it contains a slash
			const providerToUse = selectedModel.includes("/")
				? selectedModel.split("/")[0]
				: undefined;
			saveSelectedModel(selectedModel, providerToUse);
		}
	}, [selectedModel]);

	// Get user API keys for BYOK
	const getUserApiKeys = useCallback(async () => {
		if (user?.id) {
			// For authenticated users, keys should come from server
			return {};
		}
		// For anonymous users, get from local secure storage
		try {
			return await getAllKeys();
		} catch (error) {
			console.error("Failed to get API keys:", error);
			return {};
		}
	}, [user?.id]);

	// TODO: add regenerate message option
	const {
		messages,
		status,
		stop,
		setMessages,
		sendMessage: chatSendMessage,
	} = useChat({
    transport: new DefaultChatTransport({
			api: "/api/chat",
			body: async () => {
				// Ensure we have a model before proceeding
				const currentModel = selectedModelRef.current;
				if (!currentModel) {
					throw new Error("No model selected");
				}

				const userApiKeys = await getUserApiKeys();
				return {
					model: currentModel,
					system: SYSTEM_PROMPT_DEFAULT,
					userApiKeys,
				};
			},
    // biome-ignore lint/suspicious/noExplicitAny: Bridging type mismatch between `ai` and `@ai-sdk/react` transport types at compile time; runtime behavior is correct
    }) as any,
		onFinish: async ({ message }) => {
			const currentModel = selectedModelRef.current || "openai/gpt-4o-mini";

			if (message.role === "assistant") {
				const textContent = getTextContent(message.parts);
        // Serialize parts for persistence (includes reasoning when present)
        const partsJson = (() => {
          try {
            return JSON.stringify(message.parts ?? []);
          } catch {
            return undefined;
          }
        })();

				// Add model information to the message immediately
				const extendedMessage = message as ExtendedMessage;
				extendedMessage.model = currentModel;
				// Force UI update by updating the messages state
				setMessages((prevMessages) => {
					const updatedMessages = [...prevMessages];
					const lastMessageIndex = updatedMessages.length - 1;

					if (
						lastMessageIndex >= 0 &&
						updatedMessages[lastMessageIndex] &&
						updatedMessages[lastMessageIndex].role === "assistant"
					) {
						(updatedMessages[lastMessageIndex] as ExtendedMessage).model =
							currentModel;
					}

					return updatedMessages;
				});

				try {
					// Persist assistant message to cache
					if (chatId && chatId !== "new") {
						await cache.addMessage({
							chatId,
							userId: currentUserId || "local_user",
							role: "assistant",
							content: textContent,
              ...(partsJson ? { partsJson } : {}),
							model: currentModel,
							attachments: [],
							parentMessageId: undefined,
							version: 1,
							isActive: true,
							createdAt: Date.now(),
						});
					}
				} catch (error) {
					console.error("Failed to persist assistant message:", error);
				}
			}
		},
    onError: (error) => {
      const currentModel = selectedModelRef.current || "openai/gpt-4o-mini";
      const createAssistantErrorMessage = (content: string) =>
        ({
          id: `assistant-error-${Date.now()}`,
          role: "assistant" as const,
          parts: createTextParts(content),
          model: currentModel,
        }) as ExtendedMessage;

      const addAssistantErrorMessage = (msg: ExtendedMessage) => {
        setMessages((prev) => [...prev, msg]);
      };

      try {
        const errorData = JSON.parse(error.message);

        if (errorData.code === "RATE_LIMITED") {
          setRateLimited(true);
          addAssistantErrorMessage(
            createAssistantErrorMessage(
              "⚠️ Rate limit exceeded. Please wait a moment before sending another message.",
            ),
          );
          setTimeout(() => setRateLimited(false), 60000);
        } else if (errorData.code === "QUOTA_EXCEEDED") {
          setQuotaExceeded(true);
          addAssistantErrorMessage(
            createAssistantErrorMessage(
              "⚠️ API quota exceeded. Please check your API key limits or try a different model.",
            ),
          );
        } else if (errorData.code === "MODEL_NOT_SUPPORTED") {
          addAssistantErrorMessage(
            createAssistantErrorMessage(
              "⚠️ Model not supported by the gateway. Please pick a different model.",
            ),
          );
        } else if (errorData.code === "NO_API_KEY") {
          addAssistantErrorMessage(
            createAssistantErrorMessage(
              "⚠️ No LLM Gateway API key configured. Please add your API key in settings.",
            ),
          );
        } else {
          addAssistantErrorMessage(
            createAssistantErrorMessage(
              `⚠️ Error: ${errorData.error || "An unexpected error occurred"}`,
            ),
          );
        }
      } catch {
        addAssistantErrorMessage(
          createAssistantErrorMessage(`⚠️ Error: ${error.message}`),
        );
      }

			if ((error as Error).message?.includes("429")) {
				setRateLimited(true);
				setTimeout(() => setRateLimited(false), 60000);
			}
		},
	});

	// State for input management
	const [input, setInput] = useState("");

	// Ensure all messages have model information when they change
	useEffect(() => {
		setMessages((prevMessages) => {
			let hasChanges = false;
			const updatedMessages = prevMessages.map((msg) => {
				const extMsg = msg as ExtendedMessage;
				if (!extMsg.model && selectedModel) {
					hasChanges = true;
					return { ...extMsg, model: selectedModel };
				}
				return extMsg;
			});

			return hasChanges ? updatedMessages : prevMessages;
		});
	}, [selectedModel, setMessages]);

	// Load existing messages when chatId changes
	useEffect(() => {
		const loadMessages = async () => {
			if (chatId === null) {
				setMessages([]);
				return;
			}

			if (chatId && chatId !== "new") {
				try {
					// Load messages from cache
					const cachedMessages = await cache.getMessages(chatId);

          // Convert cached messages to v5 UIMessage format, preferring partsJson when present
          const v5Messages: ExtendedMessage[] = cachedMessages.map((msg) => {
            let parts: UIMessage["parts"];
            if (msg.partsJson) {
              try {
                parts = JSON.parse(msg.partsJson);
              } catch {
                parts = createTextParts(msg.content);
              }
            } else {
              parts = createTextParts(msg.content);
            }
            return {
              id: msg._id,
              role: msg.role as "user" | "assistant" | "system",
              parts,
              convexId: msg._id,
              parentMessageId: msg.parentMessageId,
              model: msg.model,
              _creationTime: msg._creationTime,
            } as ExtendedMessage;
          });

					// Set messages in useChat hook
					setMessages(v5Messages);
				} catch (error) {
					console.error("Failed to load messages:", error);
					setMessages([]);
				}
			}
		};

		loadMessages();
	}, [chatId, setMessages, cache]);

	const createNewChat = useCallback(
		async (initialMessage: string, model: string): Promise<string> => {
			if (!currentUserId) {
				throw new Error("User ID required");
			}

			// Use cache provider's createChat method which handles both auth and anonymous users
			const newChatId = await cache.createChat(
				`Chat ${new Date().toLocaleTimeString()}`, // Temporary name
				model,
				currentUserId,
			);

			return newChatId;
		},
		[currentUserId, cache],
	);

	const sendMessage = useCallback(
		async (
			message: string,
			attachments: UploadedFile[] = [],
			_search = false,
		) => {
			if (!currentUserId) {
				return;
			}
			if (isSubmitting) {
				return;
			}
			if (!selectedModel) {
				console.error("No model selected, cannot send message");
				return;
			}

			// Handle new chat creation if no chatId
			let targetChatId = chatId;
			if (!chatId || chatId === "new") {
				try {
					// Create new chat
					targetChatId = await createNewChat(message, selectedModel);

					// Navigate to the new chat with the message as a query parameter
					const url = `/chat/${targetChatId}?message=${encodeURIComponent(message)}`;
					router.push(url);
					return;
				} catch (error) {
					console.error("Failed to create new chat:", error);
					return;
				}
			}

			setIsSubmitting(true);

			try {
				// Persist user message to cache first
				if (targetChatId && targetChatId !== "new") {
					await cache.addMessage({
						chatId: targetChatId,
						userId: currentUserId,
						role: "user",
						content: message,
            // Persist the user's input as text parts for consistency with v5 structure
            partsJson: JSON.stringify([{ type: "text", text: message }]),
						model: selectedModel,
						attachments: attachments || [],
						parentMessageId: undefined,
						version: 1,
						isActive: true,
						createdAt: Date.now(),
					});
				}

				// Send message using AI SDK v5
				const _messageResult = await chatSendMessage({
					text: message,
				});

				// Add model information to the user message that was just added
				// We need to use a timeout to ensure the message has been added by the AI SDK
				setTimeout(() => {
					setMessages((prevMessages) => {
						const updatedMessages = [...prevMessages];

						// Find the most recent user message and add model info if it doesn't have it
						for (let i = updatedMessages.length - 1; i >= 0; i--) {
							const msg = updatedMessages[i] as ExtendedMessage;
							if (msg && msg.role === "user" && !msg.model) {
								msg.model = selectedModel;
								break;
							}
						}

						return updatedMessages;
					});
				}, 100); // Small delay to ensure the message is in the state
			} catch (error) {
				console.error("Failed to send message:", error);
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			currentUserId,
			chatId,
			isSubmitting,
			selectedModel,
			chatSendMessage,
			cache,
			createNewChat,
			router,
			setMessages,
		],
	);

	// Handle automatic message sending from query parameter
	useEffect(() => {
		const handleQueryMessage = async () => {
			const urlParams = new URLSearchParams(window.location.search);
			const messageFromQuery = urlParams.get("message") || urlParams.get("q");

			if (
				messageFromQuery &&
				chatId &&
				messages.length === 0 &&
				!isSubmitting &&
				selectedModel
			) {
				const decodedMessage = decodeURIComponent(messageFromQuery);
				await sendMessage(decodedMessage);

				// Clean up URL
				const newUrl = new URL(window.location.href);
				newUrl.searchParams.delete("message");
				newUrl.searchParams.delete("q");
				window.history.replaceState({}, "", newUrl.toString());
			}
		};

		const timeoutId = setTimeout(handleQueryMessage, 500);
		return () => clearTimeout(timeoutId);
	}, [chatId, messages.length, isSubmitting, selectedModel, sendMessage]);

	const regenerate = useCallback(async (_messageId: string, _model: string) => {
		// Regeneration will be implemented in a future update
	}, []);

	return (
		<MessagesContext.Provider
			value={{
				messages: messages as ExtendedMessage[],
				input,
				setInput,
				sendMessage,
				isSubmitting,
				selectedModel,
				setSelectedModel,
				status,
				quotaExceeded,
				rateLimited,
				createNewChat,
				regenerate,
				stop,
			}}
		>
			{children}
		</MessagesContext.Provider>
	);
}
