"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "~/components/ui/toast";
import { type Chat, type Message, db } from "~/db";

interface CacheContextType {
	chats: Chat[];
	getChat: (chatId: string) => Chat | undefined;
	createChat: (name: string, model: string) => Promise<string>;
	deleteChat: (chatId: string) => Promise<void>;
	updateChatModel: (chatId: string, model: string) => Promise<void>;

	// Messages
	getMessages: (chatId: string) => Promise<Message[]>;
	getMessageVersions: (messageId: string) => Promise<Message[]>;
	addMessage: (message: {
		chatId: string;
		userId: string;
		role: "user" | "assistant";
		content: string;
		model: string;
		parentMessageId?: string;
		version?: number;
		isActive?: boolean;
		createdAt: number;
	}) => Promise<string>;
	switchMessageVersion: (messageId: string) => Promise<void>;
	markAsOriginalVersion: (messageId: string) => Promise<void>;

	// Cache state
	isLoading: boolean;
	isSyncing: boolean;
	refreshCache: () => Promise<void>;

	// Force messages reload callback
	onMessagesChanged?: (chatId: string) => void;
	setOnMessagesChanged: (callback: (chatId: string) => void) => void;
}

const CacheContext = createContext<CacheContextType | null>(null);

export function useCache() {
	const context = useContext(CacheContext);
	if (!context) throw new Error("useCache must be used within CacheProvider");
	return context;
}

export function CacheProvider({
	children,
	initialChats = [],
}: { children: React.ReactNode; initialChats?: Chat[] }) {
	const { user } = useUser();
	const convex = useConvex();
	const [chats, setChats] = useState<Chat[]>(initialChats);
	const [isLoading, setIsLoading] = useState(initialChats.length === 0);
	const [isSyncing, setIsSyncing] = useState(false);

	// Message cache - keyed by chatId
	const messagesCache = useRef<Map<string, Message[]>>(new Map());
	// In-flight promise map to de-duplicate concurrent Convex reads
	const inflightRequests = useRef<Map<string, Promise<Message[]>>>(new Map());

	// Small in-memory LRU so we don't even touch IndexedDB for very hot chats
	const memLRU = useRef<Map<string, { ts: number; msgs: Message[] }>>(
		new Map(),
	);
	const LRU_MAX = 5;
	const LRU_TTL = 5 * 60_000; // 5 minutes

	// Version cache - keyed by parentMessageId
	const versionsCache = useRef<Map<string, Message[]>>(new Map());

	// Callback for forcing messages reload
	const onMessagesChangedCallback = useRef<
		((chatId: string) => void) | undefined
	>(undefined);

	// Convex queries
	const convexChats = useQuery(
		api.chat.listChats,
		user?.id ? { userId: user.id } : "skip",
	);

	const createChatMutation = useMutation(api.chat.createChat);
	const deleteChatMutation = useMutation(api.chat.deleteChat);
	const updateChatModelMutation = useMutation(api.chat.updateChatModel);
	const addMessageMutation = useMutation(api.chat.addMessage);
	const switchMessageVersionMutation = useMutation(
		api.chat.switchMessageVersion,
	);
	const markAsOriginalVersionMutation = useMutation(
		api.chat.markAsOriginalVersion,
	);

	// Initialize cache from Dexie on mount
	useEffect(() => {
		const initializeCache = async () => {
			if (!user?.id) return;

			setIsLoading(true);
			try {
				// Dexie: Load chats
				const localChats = await db.chats
					.where("userId")
					.equals(user.id)
					.toArray();
				setChats(localChats);

				// Preload messages for recent chats
				const recentChats = localChats.slice(0, 5);
				for (const chat of recentChats) {
					const messages = await db.messages
						.where("chatId")
						.equals(chat._id)
						.and((msg) => msg.isActive === true || msg.isActive === undefined) // Only active messages
						.toArray();

					// Sort messages by creation time to ensure correct order
					const sortedMessages = messages.sort(
						(a, b) => a._creationTime - b._creationTime,
					);
					messagesCache.current.set(chat._id, sortedMessages);
				}
			} catch (error) {
				console.error("Failed to initialize cache:", error);
			} finally {
				setIsLoading(false);
			}
		};

		if (isLoading) {
			initializeCache();
		}
	}, [user?.id, isLoading]);

	// Sync Convex data with Dexie cache
	useEffect(() => {
		const syncWithConvex = async () => {
			if (!convexChats || !user?.id) return;

			setIsSyncing(true);
			try {
				// Update Dexie with fresh Convex data
				await db.chats.bulkPut(convexChats as Chat[]);

				// Update local state
				setChats(convexChats as Chat[]);
			} catch (error) {
				console.error("Failed to sync with Convex:", error);
			} finally {
				setIsSyncing(false);
			}
		};

		if (convexChats) {
			syncWithConvex();
		}
	}, [convexChats, user?.id]);

	// Persist minimal chat list (id + name) to cookie for fast SSR
	useEffect(() => {
		if (typeof document === "undefined") return;
		try {
			const minimal = chats.slice(0, 20).map((c) => ({
				_id: c._id,
				name: c.name,
				currentModel: c.currentModel,
			}));
			const value = encodeURIComponent(JSON.stringify(minimal));
			document.cookie = `cc_chats=${value}; path=/; max-age=604800; SameSite=Lax`;
		} catch {
			// ignore
		}
	}, [chats]);

	// Chat operations
	const getChat = useCallback(
		(chatId: string): Chat | undefined => {
			return chats.find((chat) => chat._id === chatId);
		},
		[chats],
	);

	const createChat = useCallback(
		async (name: string, model: string): Promise<string> => {
			if (!user?.id) throw new Error("User not authenticated");

			const optimisticId = `optimistic-${Date.now()}`;
			const optimisticChat: Chat = {
				_id: optimisticId,
				name,
				userId: user.id,
				currentModel: model,
				initialModel: model,
				createdAt: Date.now(),
				_creationTime: Date.now(),
			};

			setChats((prev) => [optimisticChat, ...prev]);
			messagesCache.current.set(optimisticId, []);

			try {
				const newChatId = await createChatMutation({
					name,
					userId: user.id,
					model,
				});

				// Replace optimistic with real
				const realChat = { ...optimisticChat, _id: newChatId };
				await db.chats.put(realChat);

				setChats((prev) =>
					prev.map((chat) => (chat._id === optimisticId ? realChat : chat)),
				);

				// Update message cache key
				const messages = messagesCache.current.get(optimisticId) || [];
				messagesCache.current.delete(optimisticId);
				messagesCache.current.set(newChatId, messages);

				return newChatId;
			} catch (error) {
				setChats((prev) => prev.filter((chat) => chat._id !== optimisticId));
				messagesCache.current.delete(optimisticId);
				throw error;
			}
		},
		[user?.id, createChatMutation],
	);

	const deleteChat = useCallback(
		async (chatId: string): Promise<void> => {
			// Store current state for potential rollback
			const chatToDelete = chats.find((chat) => chat._id === chatId);
			const messagesToDelete = messagesCache.current.get(chatId) || [];

			setChats((prev) => prev.filter((chat) => chat._id !== chatId));
			messagesCache.current.delete(chatId);

			for (const message of messagesToDelete) {
				versionsCache.current.delete(message._id);
				if (message.parentMessageId) {
					versionsCache.current.delete(message.parentMessageId);
				}
			}

			// Run all deletion operations in parallel for maximum speed
			try {
				await Promise.all([
					// Delete from Convex
					deleteChatMutation({ chatId: chatId as Id<"chats"> }),
					// Delete from Dexie (chat and messages in parallel)
					Promise.all([
						db.chats.delete(chatId),
						db.messages.where("chatId").equals(chatId).delete(),
					]),
				]);

				console.log(
					`Successfully deleted chat ${chatId} and ${messagesToDelete.length} messages`,
				);
			} catch (error) {
				console.error("Failed to delete chat:", error);

				if (chatToDelete) {
					setChats((prev) => [chatToDelete, ...prev]);
					messagesCache.current.set(chatId, messagesToDelete);

					for (const message of messagesToDelete) {
						if (message.parentMessageId || message.version) {
							versionsCache.current.delete(message._id);
						}
					}
				}

				toast({ title: "Failed to delete chat", status: "error" });
				throw error;
			}
		},
		[deleteChatMutation, chats],
	);

	const updateChatModel = useCallback(
		async (chatId: string, model: string): Promise<void> => {
			setChats((prev) =>
				prev.map((chat) =>
					chat._id === chatId ? { ...chat, currentModel: model } : chat,
				),
			);

			try {
				await updateChatModelMutation({
					chatId: chatId as Id<"chats">,
					model,
				});

				await db.chats.update(chatId, { currentModel: model });
			} catch (error) {
				toast({ title: "Failed to update model", status: "error" });
				throw error;
			}
		},
		[updateChatModelMutation],
	);

	// Message operations
	const getMessages = useCallback(
		async (chatId: string): Promise<Message[]> => {
			// in-memory LRU
			const lruHit = memLRU.current.get(chatId);
			if (lruHit && Date.now() - lruHit.ts < LRU_TTL) {
				// bump recency
				memLRU.current.delete(chatId);
				memLRU.current.set(chatId, { ...lruHit, ts: Date.now() });
				return lruHit.msgs;
			}

			// de-duplicate concurrent fetches
			if (inflightRequests.current.has(chatId)) {
				const p = inflightRequests.current.get(chatId);
				if (p) return p;
			}

			const fetchPromise = (async (): Promise<Message[]> => {
				// Return cached if available (already sorted and filtered)
				const cached = messagesCache.current.get(chatId);
				if (cached) {
					// Filter to only active messages and sort
					const activeMessages = cached.filter(
						(msg) => msg.isActive === true || msg.isActive === undefined,
					);
					memLRU.current.set(chatId, { ts: Date.now(), msgs: activeMessages });
					return activeMessages.sort(
						(a, b) => a._creationTime - b._creationTime,
					);
				}

				// Load from Dexie first
				try {
					const localMessages = await db.messages
						.where("chatId")
						.equals(chatId)
						.and((msg) => msg.isActive === true || msg.isActive === undefined) // Only truly active messages
						.toArray();

					if (localMessages.length > 0) {
						// Sort messages by creation time to ensure correct order
						const sortedMessages = localMessages.sort(
							(a, b) => a._creationTime - b._creationTime,
						);
						messagesCache.current.set(chatId, sortedMessages);
						memLRU.current.set(chatId, {
							ts: Date.now(),
							msgs: sortedMessages,
						});
						return sortedMessages;
					}
				} catch (error) {
					console.error("Failed to load from Dexie:", error);
				}

				// If no local messages, try to load from Convex
				try {
					const convexMessages = await convex.query(api.chat.getMessages, {
						chatId: chatId as Id<"chats">,
					});

					if (convexMessages && convexMessages.length > 0) {
						// Save to Dexie for future use
						await db.messages.bulkPut(
							convexMessages.map((msg: Doc<"messages">) => ({
								...msg,
								_id: msg._id,
								chatId: chatId,
								_creationTime: msg._creationTime || msg.createdAt,
							})),
						);

						// Filter only active messages and sort
						const activeMessages = convexMessages.filter(
							(msg: Doc<"messages">) =>
								msg.isActive === true || msg.isActive === undefined,
						);
						const sortedMessages = activeMessages.sort(
							(a: Doc<"messages">, b: Doc<"messages">) =>
								(a._creationTime || a.createdAt) -
								(b._creationTime || b.createdAt),
						);

						messagesCache.current.set(chatId, sortedMessages as Message[]);
						memLRU.current.set(chatId, {
							ts: Date.now(),
							msgs: sortedMessages as Message[],
						});
						return sortedMessages as Message[];
					}
				} catch (error) {
					console.error("Failed to load from Convex:", error);
				}

				return [];
			})();

			inflightRequests.current.set(chatId, fetchPromise);
			try {
				const result = await fetchPromise;
				return result;
			} finally {
				inflightRequests.current.delete(chatId);
			}
		},
		[convex],
	);

	const getMessageVersions = useCallback(
		async (messageId: string): Promise<Message[]> => {
			// Check cache first
			const cached = versionsCache.current.get(messageId);
			if (cached) {
				return cached;
			}

			// future expansion
			return [];
		},
		[],
	);

	const addMessage = useCallback(
		async (messageData: {
			chatId: string;
			userId: string;
			role: "user" | "assistant";
			content: string;
			model: string;
			parentMessageId?: string;
			version?: number;
			isActive?: boolean;
			createdAt: number;
		}): Promise<string> => {
			const optimisticId = `msg-${Date.now()}-${Math.random()}`;
			const optimisticMessage: Message = {
				...messageData,
				_id: optimisticId,
				_creationTime: messageData.createdAt, // Use the provided createdAt time
				isActive: messageData.isActive ?? true,
			};

			const currentMessages =
				messagesCache.current.get(messageData.chatId) || [];
			// Add the new message at the end (it should have the latest timestamp)
			const newMessages = [...currentMessages, optimisticMessage];
			// Sort to ensure proper order, but new messages should naturally be at the end
			const sortedMessages = newMessages.sort(
				(a, b) => a._creationTime - b._creationTime,
			);
			messagesCache.current.set(messageData.chatId, sortedMessages);

			// Update LRU cache immediately with the new message
			memLRU.current.set(messageData.chatId, {
				ts: Date.now(),
				msgs: sortedMessages,
			});

			// Evict oldest LRU entries if we exceed the limit
			if (memLRU.current.size > LRU_MAX) {
				const entries = Array.from(memLRU.current.entries());
				entries.sort((a, b) => a[1].ts - b[1].ts); // Sort by timestamp
				const toDelete = entries.slice(0, entries.length - LRU_MAX);
				for (const [key] of toDelete) {
					memLRU.current.delete(key);
				}
			}

			// Notify the messages provider immediately about the optimistic update
			onMessagesChangedCallback.current?.(messageData.chatId);

			try {
				const convexData = {
					chatId: messageData.chatId as Id<"chats">,
					userId: messageData.userId,
					role: messageData.role,
					content: messageData.content,
					model: messageData.model,
					...(messageData.parentMessageId && {
						parentMessageId: messageData.parentMessageId as Id<"messages">,
					}),
					...(messageData.version && { version: messageData.version }),
				};

				const newMessageId = await addMessageMutation(convexData);

				const realMessage = { ...optimisticMessage, _id: newMessageId };
				await db.messages.put(realMessage);

				// Update the cache with the real message ID
				const messages = messagesCache.current.get(messageData.chatId) || [];
				const updatedMessages = messages.map((msg) =>
					msg._id === optimisticId ? realMessage : msg,
				);
				const sortedUpdatedMessages = updatedMessages.sort(
					(a, b) => a._creationTime - b._creationTime,
				);
				messagesCache.current.set(messageData.chatId, sortedUpdatedMessages);

				// Update LRU cache with the real message
				memLRU.current.set(messageData.chatId, {
					ts: Date.now(),
					msgs: sortedUpdatedMessages,
				});

				// Notify again after the real message is saved
				onMessagesChangedCallback.current?.(messageData.chatId);

				return newMessageId;
			} catch (error) {
				// Rollback: remove the optimistic message
				const messages = messagesCache.current.get(messageData.chatId) || [];
				const rolledBackMessages = messages.filter(
					(msg) => msg._id !== optimisticId,
				);
				messagesCache.current.set(messageData.chatId, rolledBackMessages);

				// Update LRU cache after rollback
				memLRU.current.set(messageData.chatId, {
					ts: Date.now(),
					msgs: rolledBackMessages,
				});

				// Notify about the rollback
				onMessagesChangedCallback.current?.(messageData.chatId);

				throw error;
			}
		},
		[addMessageMutation],
	);

	const switchMessageVersion = useCallback(
		async (messageId: string): Promise<void> => {
			try {
				const updatedActive = await switchMessageVersionMutation({
					messageId: messageId as Id<"messages">,
				});

				// Clear version cache
				versionsCache.current.clear();

				// If mutation returned list, update Dexie & caches in one go
				if (Array.isArray(updatedActive) && updatedActive.length > 0) {
					const first = updatedActive[0] as Message;
					const chatId = first.chatId;
					if (!chatId) return;

					// Upsert into Dexie
					await db.messages.bulkPut(
						updatedActive.map((m) => ({
							...(m as Message),
							_creationTime:
								(m as unknown as { _creationTime?: number; createdAt: number })
									._creationTime ?? (m as Message).createdAt,
						})),
					);

					messagesCache.current.set(chatId, updatedActive as Message[]);
					memLRU.current.set(chatId, {
						ts: Date.now(),
						msgs: updatedActive as Message[],
					});

					// Notify any listeners
					onMessagesChangedCallback.current?.(chatId);
				}
			} catch (error) {
				console.error("Failed to switch version:", error);
				throw error;
			}
		},
		[switchMessageVersionMutation],
	);

	const setOnMessagesChanged = useCallback(
		(callback: (chatId: string) => void) => {
			onMessagesChangedCallback.current = callback;
		},
		[],
	);

	const markAsOriginalVersion = useCallback(
		async (messageId: string): Promise<void> => {
			try {
				await markAsOriginalVersionMutation({
					messageId: messageId as Id<"messages">,
				});
			} catch (error) {
				console.error("Failed to mark as original version:", error);
				throw error;
			}
		},
		[markAsOriginalVersionMutation],
	);

	const refreshCache = useCallback(async (): Promise<void> => {
		if (!user?.id) return;

		setIsSyncing(true);
		try {
			messagesCache.current.clear();
			versionsCache.current.clear();

			const localChats = await db.chats
				.where("userId")
				.equals(user.id)
				.toArray();
			setChats(localChats);
		} catch (error) {
			console.error("Failed to refresh cache:", error);
		} finally {
			setIsSyncing(false);
		}
	}, [user?.id]);

	return (
		<CacheContext.Provider
			value={{
				chats,
				getChat,
				createChat,
				deleteChat,
				updateChatModel,
				getMessages,
				getMessageVersions,
				addMessage,
				switchMessageVersion,
				markAsOriginalVersion,
				isLoading,
				isSyncing,
				refreshCache,
				onMessagesChanged: onMessagesChangedCallback.current,
				setOnMessagesChanged,
			}}
		>
			{children}
		</CacheContext.Provider>
	);
}
