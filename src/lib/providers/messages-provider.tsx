"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { type Message as MessageAISDK, useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { useConvex } from "convex/react";
import {
	createContext,
	startTransition,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "~/components/ui/toast";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { API_ROUTE_CHAT } from "~/lib/routes";
import { useCache } from "./cache-provider";
import { getAnonId } from "~/lib/anon-id";

interface MessagesContextType {
	messages: MessageAISDK[];
	input: string;
	setInput: (input: string) => void;
	status: "streaming" | "ready" | "submitted" | "error";
	error: Error | undefined;
	isSubmitting: boolean;
	selectedModel: string;
	setSelectedModel: (model: string) => void;
	sendMessage: (message: string) => Promise<void>;
	createNewChat: (initialMessage: string, model: string) => Promise<string>;
	changeModel: (model: string) => Promise<void>;
	regenerateMessage: (messageIndex: number, newModel?: string) => Promise<void>;
	stop: () => void;
	reload: () => void;
	quotaExceeded: boolean;
	rateLimited: boolean;
}

const MessagesContext = createContext<MessagesContextType | undefined>(
	undefined,
);

export function useMessages() {
	const context = useContext(MessagesContext);
	if (!context) {
		throw new Error("useMessages must be used within a MessagesProvider");
	}
	return context;
}

interface MessagesProviderProps {
	children: React.ReactNode;
	chatId?: string;
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
	const [cachedMessages, setCachedMessages] = useState<MessageAISDK[]>([]);
	const [quotaExceeded, setQuotaExceeded] = useState(false);
	const [rateLimited, setRateLimited] = useState(false);
	const currentUserId = user?.id ?? (typeof window !== "undefined" ? getAnonId() : "");

	// Track regeneration context - use useRef to persist across re-renders
	const regenerationContext = useRef<{
		parentMessageId: string;
		version: number;
	} | null>(null);

	// Track the last user message that needs to be saved to cache
	const pendingUserMessage = useRef<{
		content: string;
		messageId: string;
	} | null>(null);

	// Track pending message from URL query parameter
	const hasSentPending = useRef(false);
	const hasAppendedPending = useRef(false);
	const [pendingInputToSend, setPendingInputToSend] = useState<string | null>(
		null,
	);

	// Load messages from cache when chatId changes
	useEffect(() => {
		const loadMessages = async () => {
			if (!chatId) {
				setCachedMessages([]);
				return;
			}

			try {
				const messages = await cache.getMessages(chatId);
				const aiSdkMessages = messages.map((m) => ({
					id: m._id,
					role: m.role,
					content: m.content,
					model: m.model,
					convexId: m._id,
					_creationTime: m._creationTime,
					createdAt: new Date(m.createdAt),
				})) as MessageAISDK[];

				setCachedMessages(aiSdkMessages);
			} catch (error) {
				console.error("Failed to load messages from cache:", error);
			}
		};

		loadMessages();
	}, [chatId, cache]);

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
		api: API_ROUTE_CHAT,
		initialMessages: cachedMessages,
		onFinish: async (message, { finishReason, usage }) => {
			if (!chatId || !currentUserId) return;

			// Save pending user message first if it exists
			if (pendingUserMessage.current) {
				try {
					const convexMessageId = await cache.addMessage({
						chatId,
						userId: currentUserId,
						role: "user",
						content: pendingUserMessage.current.content,
						model: selectedModel,
						createdAt: Date.now(),
					});

					// Update the user message with convex ID
					startTransition(() =>
						setMessages((currentMessages) =>
							currentMessages.map((msg) =>
								msg.id === pendingUserMessage.current?.messageId
									? { ...msg, convexId: convexMessageId }
									: msg,
							),
						),
					);

					pendingUserMessage.current = null;
				} catch (error) {
					console.error("Failed to save user message:", error);
				}
			}

			// Save assistant message to cache
			if (message.role === "assistant") {
				try {
					if (regenerationContext.current) {
						// For regenerated messages, mark original as version 1 and save new version
						await cache.markAsOriginalVersion(
							regenerationContext.current.parentMessageId,
						);

						const convexMessageId = await cache.addMessage({
							chatId,
							userId: currentUserId,
							role: "assistant",
							content: message.content,
							model: selectedModel,
							parentMessageId: regenerationContext.current.parentMessageId,
							version: regenerationContext.current.version,
							createdAt: Date.now(),
						});

						startTransition(() =>
							setMessages((currentMessages) =>
								currentMessages.map((msg) =>
									msg.id === message.id
										? {
												...msg,
												convexId: convexMessageId,
												model: selectedModel,
											}
										: msg,
								),
							),
						);

						regenerationContext.current = null;
					} else {
						// For regular messages (not regenerated)
						const convexMessageId = await cache.addMessage({
							chatId,
							userId: currentUserId,
							role: "assistant",
							content: message.content,
							model: selectedModel,
							createdAt: Date.now(),
						});

						startTransition(() =>
							setMessages((currentMessages) =>
								currentMessages.map((msg) =>
									msg.id === message.id
										? {
												...msg,
												convexId: convexMessageId,
												model: selectedModel,
											}
										: msg,
								),
							),
						);
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
						cache.addMessage({
							chatId,
							userId: currentUserId ?? "system",
							role: "system",
							content: sysMsg.content,
							model: selectedModel,
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
						cache.addMessage({
							chatId,
							userId: currentUserId ?? "system",
							role: "system",
							content: sysMsg.content,
							model: selectedModel,
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

	const createNewChat = useCallback(
		async (initialMessage: string, model: string): Promise<string> => {
			if (!currentUserId) throw new Error("User not authenticated");

			try {
				const chatName = initialMessage.slice(0, 50);
				const newChatId = await cache.createChat(chatName, model, currentUserId);
				return newChatId;
			} catch (error) {
				console.error("Failed to create chat:", error);
				throw error;
			}
		},
		[currentUserId, cache],
	);

	const sendMessage = useCallback(
		async (message: string) => {
			if (!currentUserId || !chatId) return;
			if (isSubmitting) return;

			setIsSubmitting(true);

			try {
				// Track this message to save it later
				pendingUserMessage.current = {
					content: message,
					messageId: `temp-${Date.now()}`,
				};

				// Use append to add the user message and trigger AI response
				await append(
					{
						role: "user",
						content: message,
					},
					{
						body: {
							chatId: chatId as Id<"chats">,
							userId: currentUserId,
							model: selectedModel,
							isAuthenticated: !!user?.id,
							systemPrompt: SYSTEM_PROMPT_DEFAULT,
						},
					},
				);
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
				setIsSubmitting(false);
			}
		},
		[currentUserId, chatId, selectedModel, append, isSubmitting, user?.id],
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
				sendMessage(pendingInputToSend);
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

	const changeModel = useCallback(
		async (newModel: string) => {
			setSelectedModel(newModel);

			// If we have a chat, update it in the cache
			if (chatId && currentUserId) {
				try {
					await cache.updateChatModel(chatId, newModel);
				} catch (error) {
					console.error("Failed to update chat model:", error);
				}
			}
		},
		[chatId, currentUserId, cache],
	);

	const regenerateMessage = useCallback(
		async (messageIndex: number, newModel?: string) => {
			if (!currentUserId || !chatId || messageIndex < 0) return;
			if (isSubmitting) return;

			setIsSubmitting(true);

			try {
				const assistantMessage = messages[messageIndex];

				if (!assistantMessage || assistantMessage.role !== "assistant") {
					console.error("Could not find assistant message to regenerate");
					return;
				}

				const convexId = (
					assistantMessage as MessageAISDK & { convexId?: string }
				).convexId;

				// Only proceed if we have a valid Convex ID (not an optimistic AI SDK ID)
				if (
					!convexId ||
					convexId.startsWith("msg-") ||
					convexId.startsWith("temp-")
				) {
					console.error(
						"No valid Convex ID found for message - cannot regenerate",
					);
					return;
				}

				const userMessage = messages[messageIndex - 1];
				if (!userMessage || userMessage.role !== "user") {
					console.error("Could not find user message to regenerate from");
					return;
				}

				const modelToUse = newModel || selectedModel;
				if (newModel && newModel !== selectedModel) {
					await changeModel(newModel);
				}

				// Get the root parent message ID (for version chaining)
				let rootParentId = convexId;

				// Check if this message already has a parent (it's already a regenerated version)
				try {
					const currentMessage = await convex.query(
						api.chat.getMessageVersions,
						{
							messageId: convexId as Id<"messages">,
						},
					);

					if (currentMessage && currentMessage.length > 0) {
						// Find the root parent (the one without a parentMessageId)
						const rootMessage = currentMessage.find(
							(msg) => !msg.parentMessageId,
						);
						if (rootMessage) {
							rootParentId = rootMessage._id;
						}
					}
				} catch (error) {
					console.error("Failed to get message versions:", error);
					// Continue with the current message as root parent
				}

				// Get the next version number from Convex using the root parent
				const nextVersion = await convex.query(api.chat.getNextVersionNumber, {
					parentMessageId: rootParentId as Id<"messages">,
				});

				// If this is the first regeneration (nextVersion is 2), mark the original as version 1
				if (nextVersion === 2) {
					await convex.mutation(api.chat.markAsOriginalVersion, {
						messageId: rootParentId as Id<"messages">,
					});
				}

				regenerationContext.current = {
					parentMessageId: rootParentId,
					version: nextVersion,
				};

				// Remove assistant message and any messages after it from UI
				const messagesToKeep = messages.slice(0, messageIndex);
				startTransition(() => setMessages(messagesToKeep));

				// Use append to regenerate instead of reload to avoid duplication
				await append(
					{
						role: "user",
						content: userMessage.content,
					},
					{
						body: {
							chatId: chatId as Id<"chats">,
							userId: currentUserId,
							model: modelToUse,
							isAuthenticated: !!user?.id,
							systemPrompt: SYSTEM_PROMPT_DEFAULT,
						},
					},
				);
			} catch (error) {
				console.error("Failed to regenerate message:", error);
				regenerationContext.current = null;
				toast({
					title: "Failed to regenerate message",
					status: "error",
				});
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			currentUserId,
			chatId,
			selectedModel,
			messages,
			setMessages,
			append,
			changeModel,
			isSubmitting,
			convex,
			user?.id,
		],
	);

	return (
		<MessagesContext.Provider
			value={{
				messages,
				input,
				setInput,
				status,
				error,
				isSubmitting,
				selectedModel,
				setSelectedModel,
				sendMessage,
				createNewChat,
				changeModel,
				regenerateMessage,
				stop,
				reload,
				quotaExceeded,
				rateLimited,
			}}
		>
			{children}
		</MessagesContext.Provider>
	);
}
