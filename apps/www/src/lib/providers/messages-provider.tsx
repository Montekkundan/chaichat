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
export type ExtendedMessage = UIMessage & {
	convexId?: string;
	parentMessageId?: string;
	model?: string;
	_creationTime?: number;
	gateway?: "llm-gateway" | "vercel-ai-gateway";
	attachments?: UploadedFile[];
};

type ModelConfig = {
	temperature: number;
	maxOutputTokens: number;
	topP: number;
	topK: number;
	frequencyPenalty: number;
	presencePenalty: number;
	openai?: {
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
	google?: {
		cachedContent?: string;
		structuredOutputs?: boolean;
		safetySettings?: Array<{ category: string; threshold: string }>;
		responseModalities?: string[];
		thinkingConfig?: { thinkingBudget?: number; includeThoughts?: boolean };
	};
	anthropic?: {
		thinkingBudget?: number;
		maxTokens?: number;
		temperature?: number;
		topP?: number;
		topK?: number;
	};
};

const createDefaultConfig = (): ModelConfig => ({
	temperature: 0.7,
	maxOutputTokens: 1024,
	topP: 1,
	topK: 0,
	frequencyPenalty: 0,
	presencePenalty: 0,
	openai: {
		reasoningEffort: undefined,
		reasoningSummary: undefined,
		textVerbosity: undefined,
		serviceTier: undefined,
		parallelToolCalls: undefined,
		store: undefined,
		strictJsonSchema: undefined,
		maxCompletionTokens: undefined,
		user: undefined,
		metadata: undefined,
	},
	google: {
		cachedContent: undefined,
		structuredOutputs: undefined,
		safetySettings: undefined,
		responseModalities: undefined,
		thinkingConfig: undefined,
	},
	anthropic: {
		thinkingBudget: undefined,
		maxTokens: undefined,
		temperature: undefined,
		topP: undefined,
		topK: undefined,
	},
});

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
	modelConfig: ModelConfig;
	setModelConfig: (update: Partial<ModelConfig>) => void;
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
	const { getChatModelConfig: getChatConfig, setChatModelConfig: setChatConfig } = cache;
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
	const [modelConfigState, setModelConfigState] = useState<ModelConfig>(
		createDefaultConfig(),
	);
	const hasHydratedConfigRef = useRef<string | null>(null);

	// Load per-chat model config (cache first, then localStorage fallback) with guard
	useEffect(() => {
		if (!chatId) return;
		if (hasHydratedConfigRef.current === chatId) return;

		let _didHydrate = false;
		try {
			const cached = getChatConfig(chatId) as
				| Partial<ModelConfig>
				| null;
			if (cached && Object.keys(cached).length > 0) {
				_didHydrate = true;
				setModelConfigState((prev) => ({ ...prev, ...cached }));
			}
		} catch { }
		if (typeof window !== "undefined") {
			try {
				const key = `chaichat_chat_config_${chatId}`;
				const raw = window.localStorage.getItem(key);
				if (raw) {
					const parsed = JSON.parse(raw) as Partial<ModelConfig>;
					if (parsed && Object.keys(parsed).length > 0) {
						_didHydrate = true;
						setModelConfigState((prev) => ({ ...prev, ...parsed }));
					}
				}
			} catch { }
		}
		hasHydratedConfigRef.current = chatId;
	}, [chatId, getChatConfig]);

	useEffect(() => {
		if (!chatId) return;
		try {
			void setChatConfig(chatId, modelConfigState as unknown as Record<string, unknown>);
		} catch { }
		if (typeof window !== "undefined") {
			try {
				const key = `chaichat_chat_config_${chatId}`;
				window.localStorage.setItem(key, JSON.stringify(modelConfigState));
			} catch { }
		}
	}, [chatId, modelConfigState, setChatConfig]);

	const selectedModelRef = useRef(selectedModel);
	useEffect(() => {
		selectedModelRef.current = selectedModel;
	}, [selectedModel]);
	const currentGatewayRef = useRef<"llm-gateway" | "vercel-ai-gateway">(
		"llm-gateway",
	);

	// Keep gateway ref in sync with the current source in localStorage
	useEffect(() => {
		const sync = () => {
			try {
				const src = window.localStorage.getItem("chaichat_models_source");
				currentGatewayRef.current =
					src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway";
			} catch {
				currentGatewayRef.current = "llm-gateway";
			}
		};
		sync();
		window.addEventListener("modelsSourceChanged", sync as EventListener);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(
				"modelsSourceChanged",
				sync as EventListener,
			);
			window.removeEventListener("storage", sync);
		};
	}, []);

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

	// Resolve current gateway label from localStorage (client-only)
	const getGatewayLabel = useCallback(():
		| "llm-gateway"
		| "vercel-ai-gateway" => {
		try {
			const src = window.localStorage.getItem("chaichat_models_source");
			return src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway";
		} catch {
			return "llm-gateway";
		}
	}, []);

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
				const gateway = (() => {
					// Always reflect the latest selection from localStorage
					try {
						const src = window.localStorage.getItem("chaichat_models_source");
						const lsGateway = src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway";
						console.log('Using gateway from localStorage:', lsGateway, 'src:', src);
						return lsGateway;
					} catch {
						console.log('Using default gateway: llm-gateway');
						return "llm-gateway";
					}
				})();
				currentGatewayRef.current = gateway;
				// Include provider-specific sub-configs based on ANY segment in the model path.
				// This supports nested providers like "groq/openai/..." where OpenAI-specific
				// options (e.g., reasoningEffort) should still be forwarded.
				const providersInPath = currentModel.toLowerCase().split("/");
				const hasOpenAI = providersInPath.includes("openai");
				const hasGoogleOrGemini =
					providersInPath.includes("google") ||
					providersInPath.includes("gemini");
				const config: ModelConfig = {
					temperature: modelConfigState.temperature,
					maxOutputTokens: modelConfigState.maxOutputTokens,
					topP: modelConfigState.topP,
					topK: modelConfigState.topK,
					frequencyPenalty: modelConfigState.frequencyPenalty,
					presencePenalty: modelConfigState.presencePenalty,
					...(hasOpenAI ? { openai: modelConfigState.openai } : {}),
					...(hasGoogleOrGemini ? { google: modelConfigState.google } : {}),
				};

				// Web search toggles from localStorage
				let searchEnabled = false;
				let searchProvider: "exa" | "firecrawl" | undefined;
				try {
					searchEnabled = window.localStorage.getItem("chaichat_search_enabled") === "true";
					const sp = window.localStorage.getItem("chai-search-provider");
					if (sp === "exa" || sp === "firecrawl") searchProvider = sp;
				} catch {}
				return {
					model: currentModel,
					system: SYSTEM_PROMPT_DEFAULT,
					userApiKeys,
					gateway,
					temperature: modelConfigState.temperature,
					config,
					searchEnabled,
					searchProvider,
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
				extendedMessage.gateway = currentGatewayRef.current;
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
						(updatedMessages[lastMessageIndex] as ExtendedMessage).gateway =
							currentGatewayRef.current;
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
							gateway: getGatewayLabel(),
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
					gateway: getGatewayLabel(),
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
		const loadInstantAndHydrate = async () => {
			if (chatId === null) {
				setMessages([]);
				return;
			}

			if (chatId && chatId !== "new") {
				// 1) Instant synchronous hydration from localStorage snapshot
				try {
					const key = `cc_msgs_${chatId}`;
					const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
					if (raw) {
						try {
							const parsed = JSON.parse(raw) as Array<{
								_id: string;
								role: string;
								content: string;
								partsJson?: string;
								model?: string;
								_creationTime?: number;
								parentMessageId?: string;
								gateway?: "llm-gateway" | "vercel-ai-gateway";
								attachments?: {
									name: string;
									url: string;
									contentType: string;
									size: number;
								}[];
							}>;
							if (Array.isArray(parsed) && parsed.length > 0) {
								const v5: ExtendedMessage[] = parsed.map((m) => {
									let parts: UIMessage["parts"];
									if (m.partsJson) {
										try {
											parts = JSON.parse(m.partsJson);
										} catch {
											parts = createTextParts(m.content);
										}
									} else {
										parts = createTextParts(m.content);
									}
									return {
										id: m._id,
										role: m.role as "user" | "assistant" | "system",
										parts,
										convexId: m._id,
										parentMessageId: m.parentMessageId,
										model: m.model,
										gateway: m.gateway,
										_creationTime: m._creationTime,
										attachments: m.attachments,
									} as ExtendedMessage;
								});
								setMessages(v5);
							}
						} catch { }
					}
				} catch { }

				// 2) Hydrate from cache (Dexie/Convex) and replace if different/newer
				try {
					const cachedMessages = await cache.getMessages(chatId);
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
							gateway: msg.gateway as
								| "llm-gateway"
								| "vercel-ai-gateway"
								| undefined,
							_creationTime: msg._creationTime,
							attachments: msg.attachments,
						} as ExtendedMessage;
					});
					setMessages(v5Messages);
				} catch (error) {
					console.error("Failed to load messages:", error);
					setMessages([]);
				}
			}
		};

		loadInstantAndHydrate();
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

			// Save current model config for this new chat id immediately
			try {
				await cache.setChatModelConfig(newChatId, modelConfigState);
			} catch { }
			if (typeof window !== "undefined") {
				try {
					const key = `chaichat_chat_config_${newChatId}`;
					window.localStorage.setItem(key, JSON.stringify(modelConfigState));
				} catch { }
			}

			return newChatId;
		},
		[currentUserId, cache, modelConfigState],
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

					// Persist pending payload (message + attachments) for the next page
					try {
						const pending = {
							chatId: targetChatId,
							message,
							attachments,
						};
						window.localStorage.setItem("chaichat_pending_send", JSON.stringify(pending));
					} catch { }

					// Navigate to the new chat with the message as a query parameter (for text fallback)
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
				const messageText = message;

				// Check if model supports vision
				const modelParts = selectedModel.split('/');
				const provider = modelParts[0];
				const modelName = modelParts[1] || selectedModel;

				const visionModels = ['gpt-4-vision-preview', 'gpt-4o', 'gpt-4o-mini'];
				const supportsVision = provider === 'openai' && visionModels.some(vm => modelName.includes(vm));

				console.log('Model supports vision:', supportsVision);

				// Check if we need to warn about non-vision model with images
				if (!supportsVision && attachments && attachments.some(att => att.contentType.startsWith('image/'))) {
					console.warn('User is trying to send images with a non-vision model:', selectedModel);
					console.warn('Vision-capable models include: gpt-4-vision-preview, gpt-4o, gpt-4o-mini');

					// If using an invalid model, try to correct it
					if (selectedModel === 'openai/gpt-4.1') {
						console.log('Detected invalid model gpt-4.1, this might be causing the issue');
						console.log('Suggesting user switch to gpt-4o for vision capabilities');
					}
				}

				// For vision models, we need to send images in the proper format
				// Include image attachments as separate parts in the message
				console.log('Processing attachments:', attachments);
				type TextPart = { type: 'text'; text: string };
				type FilePart = { type: 'file'; url: string; mediaType?: string; filename?: string };
				type MessagePart = TextPart | FilePart;
				let messageParts: MessagePart[] = [{ type: 'text', text: messageText }];

				// Declare imageAttachments outside the conditional block
				let imageAttachments: UploadedFile[] = [];

				if (attachments && attachments.length > 0) {
					imageAttachments = attachments.filter(att => att.contentType.startsWith('image/'));
					console.log('Image attachments found:', imageAttachments);

					if (imageAttachments.length > 0) {
						// Add image attachments as file parts for better provider compatibility
						const fileParts = imageAttachments.map(att => ({
							type: 'file' as const,
							url: att.url,
							mediaType: att.contentType,
							filename: att.name,
						}));

						messageParts = [...messageParts, ...fileParts];
						console.log('Message parts with images:', messageParts);

						// Test if image URLs are accessible
						for (const att of imageAttachments) {
							console.log('Testing image URL accessibility:', att.url);
							try {
								fetch(att.url, { method: 'HEAD' })
									.then(response => {
										console.log(`Image URL ${att.url} accessibility: ${response.status} ${response.statusText}`);
										if (!response.ok) {
											console.warn(`Image URL ${att.url} is not accessible: ${response.status}`);
										}
									})
									.catch(error => {
										console.error(`Failed to access image URL ${att.url}:`, error);
									});
							} catch (error) {
								console.error(`Error testing image URL ${att.url}:`, error);
							}
						}
					}
				} else {
					console.log('No attachments found');
				}

				// Persist user message to cache first
				if (targetChatId && targetChatId !== "new") {
					await cache.addMessage({
						chatId: targetChatId,
						userId: currentUserId,
						role: "user",
						content: messageText,
						// Persist the user's input with images as separate parts for vision models
						partsJson: JSON.stringify(messageParts),
						model: selectedModel,
						attachments: attachments || [],
						parentMessageId: undefined,
						version: 1,
						isActive: true,
						createdAt: Date.now(),
						gateway: getGatewayLabel(),
					});

				}

				const placeholderId = `assistant-placeholder-${Date.now()}`;
				setMessages((prev) => [
					...prev,
					{
						id: placeholderId,
						role: "assistant",
						parts: createTextParts(""),
						model: selectedModel,
						gateway: getGatewayLabel(),
						attachments: [], // Placeholder for assistant messages
					} as ExtendedMessage,
				]);

				// Send message with proper format for vision models
				const messageToSend = messageParts.length > 1
					? { parts: messageParts }
					: { text: messageText };
				console.log('Sending message to AI:', messageToSend);
				console.log('Message parts details:', messageParts.map((part, i) => ({
					index: i,
					type: part.type,
					content: part.type === 'text' ? `${part.text.substring(0, 100)}...` : part.type === 'file' ? `FILE: ${part.url}` : part
				})));

				try {
					await chatSendMessage(messageToSend as Parameters<typeof chatSendMessage>[0]);
					console.log('Message sent successfully to AI');
				} catch (error) {
					console.error('Error sending message to AI:', error);
					throw error;
				}

				// Add model information and preserve attachments in the user message
				// We need to use a timeout to ensure the message has been added by the AI SDK
				setTimeout(() => {
					setMessages((prevMessages) => {
						const updatedMessages = [...prevMessages];

						// Find the most recent user message and add model info and attachments if missing
						for (let i = updatedMessages.length - 1; i >= 0; i--) {
							const msg = updatedMessages[i] as ExtendedMessage;
							if (msg && msg.role === "user") {
								if (!msg.model) {
									msg.model = selectedModel;
									msg.gateway = getGatewayLabel();
								}
								// Preserve attachments from the original message
								if (!msg.attachments && attachments.length > 0) {
									msg.attachments = attachments;
								}
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
			getGatewayLabel,
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
				// First, check if a pending payload exists (attachments + message)
				let handled = false;
				try {
					const raw = window.localStorage.getItem("chaichat_pending_send");
					if (raw) {
						const parsed = JSON.parse(raw) as {
							chatId?: string;
							message?: string;
							attachments?: UploadedFile[];
						} | null;
						if (parsed && parsed.chatId === chatId) {
							const msg = typeof parsed.message === 'string' ? parsed.message : decodeURIComponent(messageFromQuery);
							await sendMessage(msg, Array.isArray(parsed.attachments) ? parsed.attachments : []);
							handled = true;
							window.localStorage.removeItem("chaichat_pending_send");
						}
					}
				} catch { }

				if (!handled) {
					const decodedMessage = decodeURIComponent(messageFromQuery);
					await sendMessage(decodedMessage);
				}

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
				modelConfig: modelConfigState,
				setModelConfig: (update: Partial<ModelConfig>) =>
					setModelConfigState((prev) => ({ ...prev, ...update })),
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
