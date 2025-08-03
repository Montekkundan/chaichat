"use client";

import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useUser } from "@clerk/nextjs";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { userSessionManager } from "~/lib/user-session-manager";
import { useRouter } from "next/navigation";
import { useCache, OPTIMISTIC_PREFIX } from "~/lib/providers/cache-provider";
import { migrateFromPlaintextStorage, getAllKeys } from "~/lib/secure-local-keys";
import { getBestAvailableModel } from "~/lib/models/model-utils";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";

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
	return textParts.map((part) => part.type === "text" ? part.text : "").join("");
};

// v5 helper - create text parts from content
const createTextParts = (content: string): UIMessage["parts"] => [
	{
		type: "text" as const,
		text: content,
	}
];

// v5 helper - create file parts from attachments
const createFileParts = (attachments: UploadedFile[]) => 
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
export function MessagesProvider({
	children,
	chatId,
}: MessagesProviderProps) {
	const { user } = useUser();
	const cache = useCache();
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedModel, setSelectedModel] = useState("");
	const [quotaExceeded, setQuotaExceeded] = useState(false);
	const [rateLimited, setRateLimited] = useState(false);
	const currentUserId = user?.id ?? userSessionManager.getStorageUserId();

	// Migrate from old storage format
	useEffect(() => {
		if (!user?.id && typeof window !== "undefined") {
			migrateFromPlaintextStorage().catch(console.error);
		}
	}, [user?.id]);

	// Initialize model selection
	useEffect(() => {
		const initializeModel = async () => {
			try {
				const bestModel = await getBestAvailableModel(
					undefined,
					!!user?.id,
				);
				if (bestModel && !selectedModel) {
					setSelectedModel(bestModel);
				}
			} catch (error) {
				console.error("Failed to initialize model:", error);
			}
		};

		if (!selectedModel) {
			initializeModel();
		}
	}, [user?.id, selectedModel]);

	// Listen for API key changes
	useEffect(() => {
		const handleApiKeysChanged = async () => {
			try {
				const bestModel = await getBestAvailableModel(
					undefined,
					!!user?.id,
				);
				if (bestModel && bestModel !== selectedModel) {
					setSelectedModel(bestModel);
				}
			} catch (error) {
				console.error("Failed to handle API keys change:", error);
			}
		};

		window.addEventListener("apiKeysChanged", handleApiKeysChanged);
		return () => {
			window.removeEventListener("apiKeysChanged", handleApiKeysChanged);
		};
	}, [user?.id, selectedModel]);

	const selectedModelRef = useRef(selectedModel);
	useEffect(() => {
		selectedModelRef.current = selectedModel;
	}, [selectedModel]);

	// Get user API keys for BYOK
	const getUserApiKeys = useCallback(async () => {
		if (user?.id) {
			// For authenticated users, keys should come from server
			return {};
		} else {
			// For anonymous users, get from local secure storage
			try {
				return await getAllKeys();
			} catch (error) {
				console.error("Failed to get API keys:", error);
				return {};
			}
		}
	}, [user?.id]);

	// Use the v5 useChat hook with proper configuration
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
		}),
		onFinish: async ({ message }) => {
			if (message.role === "assistant") {
				const currentModel = selectedModelRef.current || "gpt-4o";
				const textContent = getTextContent(message.parts);
				
				// model information to the message
				const extendedMessage = message as ExtendedMessage;
				extendedMessage.model = currentModel;
				
				try {
					// Persist assistant message to cache
					if (chatId && chatId !== "new") {
						await cache.addMessage({
							chatId,
							userId: currentUserId || "local_user",
							role: "assistant",
							content: textContent,
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
			const createSystemMessage = (content: string) => ({
				id: `system-${Date.now()}`,
				role: "system" as const,
				parts: createTextParts(content),
			} as ExtendedMessage);

			const addSystemMessage = (sysMsg: ExtendedMessage) => {
				setMessages((prev) => [...prev, sysMsg]);
			};

			try {
				const errorData = JSON.parse(error.message);
				
				if (errorData.code === "RATE_LIMITED") {
					setRateLimited(true);
					addSystemMessage(createSystemMessage("⚠️ Rate limit exceeded. Please wait a moment before sending another message."));
					setTimeout(() => setRateLimited(false), 60000);
				} else if (errorData.code === "QUOTA_EXCEEDED") {
					setQuotaExceeded(true);
					addSystemMessage(createSystemMessage("⚠️ API quota exceeded. Please check your API key limits or try a different model."));
				} else {
					addSystemMessage(createSystemMessage(`⚠️ Error: ${errorData.error || "An unexpected error occurred"}`));
				}
			} catch {
				addSystemMessage(createSystemMessage(`⚠️ Error: ${error.message}`));
			}

			if ((error as Error).message?.includes("429")) {
				setRateLimited(true);
				setTimeout(() => setRateLimited(false), 60000);
			}
		},
	});

	// State for input management
	const [input, setInput] = useState("");

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
					
					// Convert cached messages to v5 UIMessage format
					const v5Messages: ExtendedMessage[] = cachedMessages.map((msg) => ({
						id: msg._id,
						role: msg.role as "user" | "assistant" | "system",
						parts: createTextParts(msg.content),
						convexId: msg._id,
						parentMessageId: msg.parentMessageId,
						model: msg.model,
						_creationTime: msg._creationTime,
					}));

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
				currentUserId
			);
			
			return newChatId;
		},
		[currentUserId, cache],
	);

	const sendMessage = useCallback(
		async (
			message: string,
			attachments: UploadedFile[] = [],
			search = false,
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
						model: selectedModel,
						attachments: attachments || [],
						parentMessageId: undefined,
						version: 1,
						isActive: true,
						createdAt: Date.now(),
					});
				}

				// Send message using AI SDK v5
				await chatSendMessage({ 
					text: message,
				});

			} catch (error) {
				console.error("Failed to send message:", error);
			} finally {
				setIsSubmitting(false);
			}
		},
		[currentUserId, chatId, isSubmitting, selectedModel, chatSendMessage, cache, createNewChat, router],
	);

	// Handle automatic message sending from query parameter
	useEffect(() => {
		const handleQueryMessage = async () => {
			const urlParams = new URLSearchParams(window.location.search);
			const messageFromQuery = urlParams.get("message") || urlParams.get("q");
			
			if (messageFromQuery && chatId && messages.length === 0 && !isSubmitting && selectedModel) {
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

	const regenerate = useCallback(
		async (messageId: string, model: string) => {
			// Regeneration will be implemented in a future update
		},
		[],
	);

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
