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
import type { UploadedFile } from "~/components/chat-input/file-items";
import { toast } from "~/components/ui/toast";
import { getAnonId } from "~/lib/anon-id";
import { SYSTEM_PROMPT_DEFAULT } from "~/lib/config";
import { API_ROUTE_CHAT } from "~/lib/routes";
import { useCache } from "./cache-provider";
import { OPTIMISTIC_PREFIX } from "./cache-provider";

interface MessagesContextType {
	messages: MessageAISDK[];
	input: string;
	setInput: (input: string) => void;
	status: "streaming" | "ready" | "submitted" | "error";
	error: Error | undefined;
	isSubmitting: boolean;
	selectedModel: string;
	setSelectedModel: (model: string) => void;
	sendMessage: (message: string, attachments?: UploadedFile[], search?: boolean, captchaToken?: string) => void;
	createNewChat: (initialMessage: string, model: string) => Promise<string>;
	changeModel: (model: string) => Promise<void>;
	regenerateMessage: (messageIndex: number, newModel?: string) => Promise<void>;
	stop: () => void;
	reload: () => void;
	quotaExceeded: boolean;
	rateLimited: boolean;
	branchChat: (index: number) => Promise<string | null>;
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
	const currentUserId =
		user?.id ?? (typeof window !== "undefined" ? getAnonId() : "");

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
				const messages = await cache.getMessages(chatId);
				const aiSdkMessages = messages.map((m) => ({
					id: m._id,
					role: m.role,
					content: m.content,
					model: m.model,
					convexId: m._id,
					_creationTime: m._creationTime,
					createdAt: new Date(m.createdAt),
					experimental_attachments: m.attachments ?? [],
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
						attachments: pendingUserMessage.current.attachments,
						model: selectedModelRef.current,
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
							model: selectedModelRef.current,
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
												model: selectedModelRef.current,
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
							model: selectedModelRef.current,
							createdAt: Date.now(),
						});

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
	// biome-ignore lint/correctness/useExhaustiveDependencies: setMessages is stable from useChat
	useEffect(() => {
		if (!chatId) return;
		// Only attempt resume if chatId is optimistic ( like chai-) and last message is from user
		if (!chatId.startsWith(OPTIMISTIC_PREFIX)) return;
		if (messages.length === 0) return;

		const lastMsg = messages[messages.length - 1];
		if (!lastMsg || lastMsg.role !== "user") return;

		// Prevent duplicate resume attempts
		let cancelled = false;

		const assistantId: string = `live-${Date.now()}`;
		startTransition(() =>
			setMessages((curr) => [
				...curr,
				{
					id: assistantId,
					role: "assistant",
					content: "",
					createdAt: Date.now(),
				} as unknown as MessageAISDK,
			]),
		);
		function appendChunk(chunk: string) {
			if (cancelled) return;
			startTransition(() =>
				setMessages((curr) =>
					curr.map((m) => {
						if (m.id === assistantId) {
							const existing =
								(m as MessageAISDK & { content?: string }).content ?? "";
							return { ...m, content: existing + chunk } as typeof m;
						}
						return m;
					}),
				),
			);
		}
		function done() {
			if (cancelled) return;
			// Persist final assistant message
			const finalContent = String(
				(
					messages.find((m) => m.id === assistantId) as MessageAISDK & {
						content?: string;
					}
				)?.content ?? "",
			);
			void cache
				.addMessage({
					chatId: chatId as string,
					userId: currentUserId ?? "system",
					role: "assistant",
					content: finalContent,
					model: String(selectedModelRef.current || "gpt-4o"),
					createdAt: Date.now(),
				})
				.catch(() => {});
		}

		resumeAssistantStream({
			chatId,
			appendAssistantChunk: appendChunk,
			onDone: done,
		});

		return () => {
			cancelled = true;
		};
	}, [chatId, messages, cache, currentUserId]);

	const createNewChat = useCallback(
		async (initialMessage: string, model: string): Promise<string> => {
			if (!currentUserId) throw new Error("User not authenticated");

			try {
				const chatName = initialMessage.slice(0, 50);
				const newChatId = await cache.createChat(
					chatName,
					model,
					currentUserId,
				);
				return newChatId;
			} catch (error) {
				console.error("Failed to create chat:", error);
				throw error;
			}
		},
		[currentUserId, cache],
	);

	const sendMessage = useCallback(
		(
			message: string,
			attachments: UploadedFile[] = [],
			search = false,
			captchaToken?: string,
		) => {
			if (!currentUserId || !chatId) return;
			if (isSubmitting) return;

			setIsSubmitting(true);

			try {
				// 1) Persist immediately so the message survives refresh.
				void cache
					.addMessage({
						chatId,
						userId: currentUserId,
						role: "user",
						content: message,
						model: selectedModelRef.current,
						attachments,
						createdAt: Date.now(),
					})
					.then((convexId) => {
						// Update the AI-SDK message with the real/optimistic id so any
						// later operations (e.g. regenerate) have access to it.
						startTransition(() => {
							setMessages((current) =>
								current.map((msg) => {
									if (
										msg.role === "user" &&
										msg.content === message &&
										// Message was appended just now; it won't have a convexId yet
										// biome-ignore lint/suspicious/noExplicitAny: convexId is an extension not present in the base Message type
										!(msg as any).convexId
									) {
										return { ...msg, convexId } as typeof msg;
									}
									return msg;
								}),
							);
						});
					})
					.catch((err) => {
						console.error("Failed to persist user message early:", err);
					});

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
							chatId: chatId as Id<"chats">,
							userId: currentUserId,
							model: selectedModelRef.current,
							isAuthenticated: !!user?.id,
							systemPrompt: SYSTEM_PROMPT_DEFAULT,
							searchEnabled: search,
							...(captchaToken ? { captchaToken } : {}),
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

	const changeModel = useCallback(
		async (newModel: string) => {
			setSelectedModel(newModel);
			selectedModelRef.current = newModel;

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
					convexId.startsWith("temp-") ||
					convexId.startsWith(OPTIMISTIC_PREFIX)
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

				const modelToUse = newModel || selectedModelRef.current;
				if (newModel && newModel !== selectedModelRef.current) {
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

				// Remove the original user + assistant messages locally before regeneration starts
				const originalUserId = userMessage.id as string;
				const originalAssistantId = assistantMessage.id as string;

				const messagesToKeep = messages.filter(
					(m) => m.id !== originalUserId && m.id !== originalAssistantId,
				);

				startTransition(() => setMessages(messagesToKeep));

				// after appended, ensure the originals stay removed.
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

				startTransition(() =>
					setMessages((curr) =>
						curr.filter(
							(m) => m.id !== originalUserId && m.id !== originalAssistantId,
						),
					),
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
			messages,
			setMessages,
			append,
			changeModel,
			isSubmitting,
			convex,
			user?.id,
		],
	);

	const branchChat = useCallback(
		async (uptoIndex: number): Promise<string | null> => {
			if (!currentUserId) return null;
			const name =
				messages.find((m) => m.role === "user")?.content.slice(0, 30) ||
				"Branched chat";
			try {
				const newChatId = await cache.createChat(
					name,
					selectedModelRef.current,
					currentUserId,
					chatId,
				);

				// excluding system and inactive versions
				const msgsToCopy = messages.slice(0, uptoIndex + 1).filter(
					(m) =>
						m.role === "user" ||
						// biome-ignore lint/suspicious/noExplicitAny: messages typed loosely from AI SDK
						(m.role === "assistant" && ((m as any).isActive ?? true)),
				);
				for (const msg of msgsToCopy) {
					await cache.addMessage({
						chatId: newChatId,
						userId: msg.role === "user" ? currentUserId : "system", // keep same
						role: msg.role as "user" | "assistant" | "system",
						content: msg.content,
						// biome-ignore lint/suspicious/noExplicitAny: message model may be stored loosely
						model: (msg as any).model || selectedModelRef.current,
						// biome-ignore lint/suspicious/noExplicitAny: experimental attachments are optional legacy field
						attachments: (msg as any).experimental_attachments || [],
						createdAt: Date.now(),
					});
				}
				return newChatId;
			} catch (e) {
				console.error("branchChat failed", e);
				return null;
			}
		},
		[currentUserId, cache, messages, chatId],
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
				branchChat,
			}}
		>
			{children}
		</MessagesContext.Provider>
	);
}

// TODO: ⚠️ Resumable stream logic is still buggy; needs major fixes soon.
async function resumeAssistantStream({
	chatId,
	appendAssistantChunk,
	onDone,
}: {
	chatId: string;
	appendAssistantChunk: (chunk: string) => void;
	onDone: () => void;
}) {
	try {
		const res = await fetch(`/api/chat?chatId=${encodeURIComponent(chatId)}`);
		if (!res.ok || !res.body) {
			onDone();
			return;
		}
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let done = false;
		while (!done) {
			const { value, done: readerDone } = await reader.read();
			done = readerDone;
			if (value) {
				appendAssistantChunk(decoder.decode(value));
			}
		}
	} catch (err) {
		console.error("Failed to resume stream", err);
	} finally {
		onDone();
	}
}
