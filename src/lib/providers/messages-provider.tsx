"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { type Message as MessageAISDK, useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { useConvex } from "convex/react";
import {
	type ReactNode,
	createContext,
	startTransition,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { UploadedFile } from "~/components/chat-input/file-items";
import { toast } from "~/components/ui/toast";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { getBestAvailableModel } from "~/lib/model-utils";
import {
	getAllKeys,
	migrateFromPlaintextStorage,
} from "~/lib/secure-local-keys";
import { OPTIMISTIC_PREFIX, useCache } from "./cache-provider";
import { localChatStorage, type LocalMessage } from "~/lib/local-chat-storage";
import type { Message } from "~/db";
import { userSessionManager } from "~/lib/user-session-manager";

// Extended message type with Convex-specific properties
type ExtendedMessage = MessageAISDK & {
	convexId?: string;
	parentMessageId?: string;
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
	initialModel?: string;
}

export function MessagesProvider({
	children,
	chatId,
	initialModel = "gpt-4o",
}: MessagesProviderProps) {
	

	const { user } = useUser();
	const cache = useCache();
	const convex = useConvex();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedModel, setSelectedModel] = useState(initialModel);
	const [cachedMessages, setCachedMessages] = useState<ExtendedMessage[]>([]);
	const [quotaExceeded, setQuotaExceeded] = useState(false);
	const [rateLimited, setRateLimited] = useState(false);
	const currentUserId = user?.id ?? userSessionManager.getStorageUserId();

	// Run migration on first load for non-logged users
	useEffect(() => {
		if (!user?.id && typeof window !== "undefined") {
			migrateFromPlaintextStorage().catch(console.error);
		}
	}, [user?.id]);

	// Track if we've initialized the model to avoid re-running
	const modelInitialized = useRef(false);

	// Initialize model based on available API keys
	useEffect(() => {
		const initializeModel = async () => {
			try {
				const bestModel = await getBestAvailableModel(undefined, !!user?.id);
				if (bestModel && bestModel !== selectedModel) {
					setSelectedModel(bestModel);
				} else if (!bestModel) {
					// No API keys available, don't set any model
					setSelectedModel("");
				}
				modelInitialized.current = true;
			} catch (error) {
				console.error("Failed to initialize model:", error);
			}
		};

		// Only run this on first load, not for existing chats
		if (!chatId && !modelInitialized.current) {
			initializeModel();
		}
	}, [user?.id, chatId, selectedModel]);

	// Track regeneration context - use useRef to persist across re-renders
	const regenerationContext = useRef<{
		parentMessageId: string;
		version: number;
	} | null>(null);

	// Track the last user message that needs to be saved to cache
	const pendingUserMessage = useRef<{
		content: string;
		attachments: UploadedFile[];
		messageId: string;
	} | null>(null);

	// Track pending message from URL query parameter
	const hasSentPending = useRef(false);
	const hasAppendedPending = useRef(false);
	const [pendingInputToSend, setPendingInputToSend] = useState<string | null>(
		null,
	);

	const selectedModelRef = useRef(selectedModel);
	useEffect(() => {
		selectedModelRef.current = selectedModel;
	}, [selectedModel]);

	// Load messages from cache when chatId changes
	useEffect(() => {
		const loadMessages = async () => {
			if (!chatId) {
				setCachedMessages([]);
				return;
			}

			try {
				let messages: LocalMessage[] | Message[];
				if (!user?.id) {
					// For non-logged users, load from local storage
					messages = await localChatStorage.getMessages(chatId);
				} else {
					// For logged users, load from both cache and local storage
					const [cacheMessages, localMessages] = await Promise.all([
						cache.getMessages(chatId),
						localChatStorage.getMessages(chatId, currentUserId)
					]);
					
					// Merge messages, prioritizing cache messages
					const messageMap = new Map();
					
					// Add local messages first
					for (const msg of localMessages) {
						messageMap.set(msg._id, msg);
					}
					
					// Override with cache messages (they're more up-to-date)
					for (const msg of cacheMessages) {
						messageMap.set(msg._id, msg);
					}
					
					messages = Array.from(messageMap.values()).sort((a, b) => a.createdAt - b.createdAt);
				}

				const aiSdkMessages = messages.map((m) => {
					return {
						id: m._id,
						role: m.role,
						content: m.content,
						model: m.model,
						convexId: m._id,
						_creationTime: m._creationTime,
						createdAt: new Date(m.createdAt),
						experimental_attachments: m.attachments ?? [],
					};
				}) as ExtendedMessage[];

				setCachedMessages(aiSdkMessages);
			} catch (error) {
				console.error("Failed to load messages from cache:", error);
			}
		};

		loadMessages();
	}, [chatId, cache, currentUserId, user?.id]);

	const {
		messages,
		input,
		handleSubmit,
		status,
		error,
		reload,
		stop,
		setMessages,
		setInput,
		append,
	} = useChat({
		// TODO: this assumes free-tier always streams properly; may need revision
		api: "/api/chat",
		onFinish: async (message, { finishReason, usage }) => {
			console.log("✅ Message finished:", {
				messageId: message.id,
				finishReason,
				usage,
			});

			// Save user message if it was delayed
			if (pendingUserMessage.current) {
				try {
					if (!user?.id) {
						// For non-logged users, use local storage
						const localMessageId = await localChatStorage.addMessage(
							chatId as string,
							"user",
							pendingUserMessage.current.content,
							selectedModelRef.current,
							pendingUserMessage.current.attachments
						);

						// Update the AI-SDK message with the local message id
						startTransition(() => {
							setMessages((currentMessages) =>
								currentMessages.map((msg) =>
									msg.id === pendingUserMessage.current?.messageId
										? {
												...msg,
												convexId: localMessageId,
												model: selectedModelRef.current,
											}
										: msg,
								),
							);
						});
					} else {
						// For logged users, save to both cache and local storage
						const [convexMessageId, localMessageId] = await Promise.all([
							cache.addMessage({
								chatId: chatId as string,
								userId: currentUserId,
								role: "user",
								content: pendingUserMessage.current.content,
								model: selectedModelRef.current,
								attachments: pendingUserMessage.current.attachments,
								createdAt: Date.now(),
							}),
							localChatStorage.addMessage(
								chatId as string,
								"user",
								pendingUserMessage.current.content,
								selectedModelRef.current,
								pendingUserMessage.current.attachments,
								currentUserId
							)
						]);

						// Update the AI-SDK message with the convex message id (primary)
						startTransition(() => {
							setMessages((currentMessages) =>
								currentMessages.map((msg) =>
									msg.id === pendingUserMessage.current?.messageId
										? {
												...msg,
												convexId: convexMessageId,
												model: selectedModelRef.current,
											}
										: msg,
								),
							);
						});
					}
				} catch (error) {
					console.error("Failed to save pending user message:", error);
				} finally {
					pendingUserMessage.current = null;
				}
			}

			// Save assistant message to cache
			if (message.role === "assistant") {
				try {
					if (!user?.id) {
						// For non-logged users, use local storage
						const localMessageId = await localChatStorage.addMessage(
							chatId as string,
							"assistant",
							message.content,
							selectedModelRef.current
						);

						startTransition(() =>
							setMessages((currentMessages) =>
								currentMessages.map((msg) =>
									msg.id === message.id
										? {
												...msg,
												convexId: localMessageId,
												model: selectedModelRef.current,
											}
										: msg,
								),
							),
						);
					} else {
						// For logged users, save to both cache and local storage
						if (regenerationContext.current) {
							// For regenerated messages, mark original as version 1 and save new version
							await cache.markAsOriginalVersion(
								regenerationContext.current.parentMessageId,
							);

							const [convexMessageId, localMessageId] = await Promise.all([
								cache.addMessage({
									chatId: chatId as string,
									userId: currentUserId,
									role: "assistant",
									content: message.content,
									model: selectedModelRef.current,
									parentMessageId: regenerationContext.current.parentMessageId,
									version: regenerationContext.current.version,
									createdAt: Date.now(),
								}),
								localChatStorage.addMessage(
									chatId as string,
									"assistant",
									message.content,
									selectedModelRef.current,
									undefined,
									currentUserId
								)
							]);

							startTransition(() =>
								setMessages((currentMessages) =>
									currentMessages.map((msg) =>
										msg.id === message.id
											? {
													...msg,
													convexId: convexMessageId,
													model: selectedModelRef.current,
												}
											: msg,
									),
								),
							);

							regenerationContext.current = null;
						} else {
							// For regular messages (not regenerated)
							const [convexMessageId, localMessageId] = await Promise.all([
								cache.addMessage({
									chatId: chatId as string,
									userId: currentUserId,
									role: "assistant",
									content: message.content,
									model: selectedModelRef.current,
									createdAt: Date.now(),
								}),
								localChatStorage.addMessage(
									chatId as string,
									"assistant",
									message.content,
									selectedModelRef.current,
									undefined,
									currentUserId
								)
							]);

							startTransition(() =>
								setMessages((currentMessages) =>
									currentMessages.map((msg) =>
										msg.id === message.id
											? {
													...msg,
													convexId: convexMessageId,
													model: selectedModelRef.current,
												}
											: msg,
									),
								),
							);
						}
					}
				} catch (error) {
					console.error("Failed to save assistant message:", error);
					regenerationContext.current = null;
				}
			}
		},
		onError: (error) => {
			try {
				const errObj = JSON.parse((error as Error).message);
				if (errObj?.code === "QUOTA_EXCEEDED") {
					setQuotaExceeded(true);
					const sysMsg = {
						id: `system-${Date.now()}`,
						role: "system" as const,
						content: errObj.error ?? "Quota exceeded.",
						createdAt: Date.now(),
					} as unknown as MessageAISDK;
					setMessages((prev) => [...prev, sysMsg]);

					if (chatId) {
						// chatId is guaranteed to be defined because effect early-returned otherwise
						void cache.addMessage({
							chatId: chatId as string,
							userId: currentUserId ?? "system",
							role: "system",
							content: sysMsg.content,
							model: selectedModelRef.current,
							createdAt: Date.now(),
						});
					}
					return;
				}
				if (errObj?.code === "RATE_LIMITED" || errObj?.status === 429) {
					setRateLimited(true);
					const sysMsg = {
						id: `system-${Date.now()}`,
						role: "system" as const,
						content:
							errObj.error ??
							"Rate limit exceeded. Please wait a moment and try again.",
						createdAt: Date.now(),
					} as unknown as MessageAISDK;
					setMessages((prev) => [...prev, sysMsg]);

					if (chatId) {
						// chatId is guaranteed to be defined because effect early-returned otherwise
						void cache.addMessage({
							chatId: chatId as string,
							userId: currentUserId ?? "system",
							role: "system",
							content: sysMsg.content,
							model: selectedModelRef.current,
							createdAt: Date.now(),
						});
					}
					return;
				}
			} catch {}

			// fallback string detection
			if ((error as Error).message?.includes("429")) {
				return;
			}

			// handled expected errors; do not log
			return;
		},
	});

	// Handle query parameter for auto-sending messages (after useChat)
	useEffect(() => {
		// Only run on client-side and if we haven't already processed the pending input
		if (typeof window !== "undefined" && !hasAppendedPending.current) {
			const url = new URL(window.location.href);
			const pendingInput = url.searchParams.get("q");

			if (pendingInput) {
				setPendingInputToSend(pendingInput);
				hasAppendedPending.current = true;

				// Clean up URL
				url.searchParams.delete("q");
				window.history.replaceState({}, "", url.pathname + url.search);
			}
		}
	}, []);

	// Reset pending flags when chatId changes (after useChat)
	useEffect(() => {
		if (chatId === null) {
			setMessages([]);
			setCachedMessages([]);
		}
		hasSentPending.current = false;
		hasAppendedPending.current = false;
	}, [chatId, setMessages]);

	// Sync cached messages with AI SDK when cache changes
	useEffect(() => {
		if (cachedMessages.length > 0 && messages.length === 0) {
			startTransition(() => setMessages(cachedMessages));
		}
	}, [cachedMessages, messages.length, setMessages]);

	// ----- Resume streaming on refresh for optimistic chats -----
	// Note: Stream resumption temporarily disabled due to API changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: setMessages is stable from useChat
	useEffect(() => {
		if (!chatId) return;
		// Only attempt resume if chatId is optimistic ( like chai-) and last message is from user
		if (!chatId.startsWith(OPTIMISTIC_PREFIX)) return;
		if (messages.length === 0) return;

		const lastMsg = messages[messages.length - 1];
		if (!lastMsg || lastMsg.role !== "user") return;

		// Note: Stream resumption functionality removed for now - will be fixed in future update
		console.log("Stream resumption temporarily disabled");
	}, [chatId, messages, cache, currentUserId]);

	const createNewChat = useCallback(
		async (initialMessage: string, model: string): Promise<string> => {
			if (!currentUserId) {
				throw new Error("No user ID available");
			}
			
			if (!user?.id) {
				// For non-logged users, use local storage
				try {
					const chatName = initialMessage.slice(0, 50);
					const newChatId = await localChatStorage.createChat(chatName, model);
					return newChatId;
				} catch (error) {
					console.error("Failed to create local chat:", error);
					throw error;
				}
			}

			// For logged users, create in both cache and local storage
			try {
				const chatName = initialMessage.slice(0, 50);
				const [convexChatId, localChatId] = await Promise.all([
					cache.createChat(chatName, model, currentUserId),
					localChatStorage.createChat(chatName, model, undefined, currentUserId)
				]);
				return convexChatId; // Return convex ID as primary
			} catch (error) {
				console.error("Failed to create chat:", error);
				throw error;
			}
		},
		[currentUserId, cache, user?.id],
	);

	const sendMessage = useCallback(
		async (
			message: string,
			attachments: UploadedFile[] = [],
			search = false,
		) => {
			if (!currentUserId || !chatId) return;
			if (isSubmitting) return;

			setIsSubmitting(true);

			try {
				if (!user?.id) {
					// For non-logged users, use local storage
					void localChatStorage
						.addMessage(
							chatId,
							"user",
							message,
							selectedModelRef.current,
							attachments
						)
						.then((localMessageId) => {
							// Update the AI-SDK message with the local message id
							startTransition(() => {
								setMessages((current) =>
									current.map((msg) => {
										if (
											msg.role === "user" &&
											msg.content === message &&
											// Message was appended just now; it won't have a convexId yet
											!(msg as ExtendedMessage).convexId
										) {
											return { ...msg, convexId: localMessageId } as ExtendedMessage;
										}
										return msg;
									}),
								);
							});
						})
						.catch((err) => {
							console.error("Failed to persist user message to local storage:", err);
						});
				} else {
					// For logged users, save to both cache and local storage
					Promise.all([
						cache.addMessage({
							chatId,
							userId: currentUserId,
							role: "user",
							content: message,
							model: selectedModelRef.current,
							attachments,
							createdAt: Date.now(),
						}),
						localChatStorage.addMessage(
							chatId,
							"user",
							message,
							selectedModelRef.current,
							attachments,
							currentUserId
						)
					])
						.then(([convexId, localId]) => {
							// Update the AI-SDK message with the convex message id (primary)
							startTransition(() => {
								setMessages((current) =>
									current.map((msg) => {
										if (
											msg.role === "user" &&
											msg.content === message &&
											// Message was appended just now; it won't have a convexId yet
											!(msg as ExtendedMessage).convexId
										) {
											return { ...msg, convexId } as ExtendedMessage;
										}
										return msg;
									}),
								);
							});
						})
						.catch((err) => {
							console.error("Failed to persist user message:", err);
						});
				}

				// Get local API keys for non-logged users (async)
				const localKeys = user?.id ? {} : await getAllKeys();

				// 2) Trigger the AI SDK streaming request.
				void append(
					{
						role: "user",
						content: message,
						// biome-ignore lint/suspicious/noExplicitAny: upstream library expects this field name
						experimental_attachments: attachments as any,
					},
					{
						body: {
							// For local users, don't cast as Convex ID since it's not a Convex ID
							chatId: currentUserId === 'local_user' ? chatId : chatId as Id<"chats">,
							userId: currentUserId,
							model: selectedModelRef.current,
							isAuthenticated: !!user?.id,
							systemPrompt: SYSTEM_PROMPT_DEFAULT,
							searchEnabled: search,
							...(Object.keys(localKeys).length > 0
								? { userApiKeys: localKeys }
								: {}),
						},
					},
				).catch((err) => {
					console.error("append failed:", err);
				});

				// We've already persisted, so onFinish doesn't need to run its user-message save path.
				pendingUserMessage.current = null;
			} catch (error) {
				try {
					const errObj = JSON.parse((error as Error).message);
					if (errObj?.code === "QUOTA_EXCEEDED") {
						// already handled elsewhere; do not log
						return;
					}
				} catch {}
				console.error("Failed to send message:", error);
				toast({
					title: "Failed to send message",
					status: "error",
				});
			} finally {
				// we clear submitting immediately; loader handled by upstream hooks
				setIsSubmitting(false);
			}
		},
		[currentUserId, chatId, isSubmitting, cache, setMessages, append, user?.id],
	);

	// Send pending message when conditions are right (after sendMessage is defined)
	useEffect(() => {
		if (
			pendingInputToSend &&
			chatId &&
			currentUserId &&
			status === "ready" &&
			messages.length === 0 &&
			!hasSentPending.current
		) {
			hasSentPending.current = true;

			setTimeout(() => {
				sendMessage(pendingInputToSend, [], false);
				setPendingInputToSend(null);
			}, 300);
		}
	}, [
		pendingInputToSend,
		chatId,
		currentUserId,
		status,
		messages.length,
		sendMessage,
	]);

	const regenerate = useCallback(
		(messageId: string, model: string) => {
			if (!currentUserId || !chatId) return;

			setSelectedModel(model);

			const messageToRegenerate = messages.find(
				(m) =>
					m.id === messageId || (m as ExtendedMessage).convexId === messageId,
			);
			if (!messageToRegenerate) {
				console.error("Message to regenerate not found:", messageId);
				return;
			}

			if (messageToRegenerate.role !== "assistant") {
				console.error("Can only regenerate assistant messages");
				return;
			}

			// Find the user message that prompted this assistant response
			const messageIndex = messages.findIndex(
				(m) =>
					m.id === messageId || (m as ExtendedMessage).convexId === messageId,
			);
			if (messageIndex === -1 || messageIndex === 0) {
				console.error("Cannot find user message for regeneration");
				return;
			}

			const userMessage = messages[messageIndex - 1];
			if (!userMessage || userMessage.role !== "user") {
				console.error("Previous message is not a user message");
				return;
			}

			// Remove the assistant message and all messages after it
			const messagesToKeep = messages.slice(0, messageIndex);
			setMessages(messagesToKeep);

			// Set regeneration context
			const convexId =
				(messageToRegenerate as ExtendedMessage).convexId || messageId;
			const existingVersions = messages.filter(
				(m) =>
					(m as ExtendedMessage).convexId === convexId ||
					(m as ExtendedMessage).parentMessageId === convexId,
			);
			const nextVersion = existingVersions.length + 1;

			regenerationContext.current = {
				parentMessageId: convexId,
				version: nextVersion,
			};

			// Trigger regeneration by resending the user message
			const attachments = userMessage.experimental_attachments || [];
			setTimeout(() => {
				sendMessage(userMessage.content, attachments as UploadedFile[], false);
			}, 100);
		},
		[currentUserId, chatId, messages, setMessages, sendMessage],
	);

	return (
		<MessagesContext.Provider
			value={{
				messages,
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
