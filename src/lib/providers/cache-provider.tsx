"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useUser } from "@clerk/nextjs";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
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
	createChat: (
		name: string,
		model: string,
		userIdOverride?: string,
		parentChatId?: string,
	) => Promise<string>;
	deleteChat: (chatId: string) => Promise<void>;
	updateChatModel: (chatId: string, model: string) => Promise<void>;

	// Messages
	getMessages: (chatId: string) => Promise<Message[]>;
	getMessageVersions: (messageId: string) => Promise<Message[]>;
	addMessage: (message: {
		chatId: string;
		userId: string;
		role: "user" | "assistant" | "system";
		content: string;
		model: string;
		attachments?: {
			name: string;
			url: string;
			contentType: string;
			size: number;
		}[];
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

export const OPTIMISTIC_PREFIX = "chai-";

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
	const router = useRouter();
	const routerRef = useRef(router);
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

	// Map to translate optimistic chat IDs to their real Convex IDs once available (stable ref)
	const optimisticToRealChatId = useRef<Map<string, string>>(new Map());

	// Callback for forcing messages reload
	const onMessagesChangedCallback = useRef<
		((chatId: string) => void) | undefined
	>(undefined);

	// Convex queries
	const convexChats = useQuery(
		api.chat.listChats,
		user?.id ? { userId: user.id } : "skip",
	);

	// For non-authenticated users, fetch public chats
	const convexPublicChats = useQuery(
		api.chat.listPublicChats,
		!user?.id ? {} : "skip",
	);

	// Combine user chats and public chats
	const effectiveChats = user?.id ? convexChats : convexPublicChats;

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
			setIsLoading(true);
			try {
				if (user?.id) {
					// For authenticated users: Load chats from Dexie
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
				}
				// For non-authenticated users, we'll rely on the effectiveChats from convex
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
			if (!effectiveChats) return;

			setIsSyncing(true);
			try {
				if (user?.id) {
					// For authenticated users: Update Dexie with fresh Convex data
					await db.chats.bulkPut(effectiveChats as Chat[]);
				}

				// Update local state for both authenticated and non-authenticated users
				setChats(effectiveChats as Chat[]);
			} catch (error) {
				console.error("Failed to sync with Convex:", error);
			} finally {
				setIsSyncing(false);
			}
		};

		if (effectiveChats) {
			syncWithConvex();
		}
	}, [effectiveChats, user?.id]);

	// Hydrate chats quickly from cookie to avoid UI flash
	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (initialChats.length === 0 && typeof document !== "undefined") {
			try {
				const match = document.cookie.match(/cc_chats=([^;]+)/);
				if (match?.[1]) {
					const parsed = JSON.parse(decodeURIComponent(match[1]));
					if (Array.isArray(parsed) && parsed.length > 0) {
						setChats(parsed as Chat[]);
					}
				}
			} catch {
				/* ignore parse errors */
			}
		}
	}, []);

	// Persist minimal chat list (id + name) to cookie for fast SSR
	useEffect(() => {
		if (typeof document === "undefined") return;
		try {
			const minimal = chats.slice(0, 20).map((c) => ({
				_id: c._id,
				name: c.name,
				currentModel: c.currentModel,
				parentChatId: c.parentChatId ?? null,
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: router is stable and intentional
	const createChat = useCallback(
		async (
			name: string,
			model: string,
			userIdOverride?: string,
			parentChatId?: string,
		): Promise<string> => {
			const uid = userIdOverride ?? user?.id;
			if (!uid) throw new Error("User not authenticated");

			const optimisticId = `${OPTIMISTIC_PREFIX}${Date.now()}`;
			const optimisticChat: Chat = {
				_id: optimisticId,
				name,
				userId: uid,
				currentModel: model,
				initialModel: model,
				parentChatId,
				createdAt: Date.now(),
				_creationTime: Date.now(),
				isPublic: false,
			};

			setChats((prev) => [optimisticChat, ...prev]);
			messagesCache.current.set(optimisticId, []);

			const mutationArgs: {
				name: string;
				userId: string;
				model: string;
				parentChatId?: Id<"chats">;
			} = {
				name,
				userId: uid,
				model,
				...(parentChatId ? { parentChatId: parentChatId as Id<"chats"> } : {}),
			};

			void createChatMutation(mutationArgs)
				.then(async (realId) => {
					const realChat = { ...optimisticChat, _id: realId };
					await db.chats.put(realChat);
					setChats((prev) =>
						prev.map((c) => (c._id === optimisticId ? realChat : c)),
					);

					const msgs = messagesCache.current.get(optimisticId) || [];

					// Re-associate any optimistic messages with the new real chat id
					const reassignedMsgs = msgs.map((m) => ({ ...m, chatId: realId }));

					messagesCache.current.delete(optimisticId);
					messagesCache.current.set(realId, reassignedMsgs);

					// Persist reassigned messages to Dexie so they survive reloads
					try {
						await db.messages.bulkPut(reassignedMsgs);
					} catch {
						/* ignore */
					}

					// --- Push any optimistic messages to Convex now that we have a real chat id ---
					for (const localMsg of reassignedMsgs) {
						if (localMsg._id.startsWith(OPTIMISTIC_PREFIX)) {
							try {
								const newMessageId = await addMessageMutation({
									chatId: realId as Id<"chats">,
									userId: localMsg.userId,
									role: localMsg.role,
									content: localMsg.content,
									model: localMsg.model,
									attachments: localMsg.attachments,
									...(localMsg.parentMessageId && {
										parentMessageId: localMsg.parentMessageId as Id<"messages">,
									}),
									...(localMsg.version && { version: localMsg.version }),
								});

								// update caches with real message id
								localMsg._id = newMessageId;
							} catch {
								/* ignore network errors */
							}
						}
					}
					onMessagesChangedCallback.current?.(realId);

					// Record mapping so future message writes use the real id
					optimisticToRealChatId.current.set(optimisticId, realId);

					// --- Clean up any leftover optimistic rows in Dexie & memory ---
					try {
						await db.messages
							.where("chatId")
							.equals(realId)
							.and((m) => m._id.startsWith(OPTIMISTIC_PREFIX))
							.delete();

						// Remove them from in-memory caches too
						const withoutOpt = (messagesCache.current.get(realId) || []).filter(
							(m) => !m._id.startsWith(OPTIMISTIC_PREFIX),
						);
						messagesCache.current.set(realId, withoutOpt);
						memLRU.current.set(realId, { ts: Date.now(), msgs: withoutOpt });
					} catch {
						/* ignore */
					}

					// TODO: ⚠️ Resumable stream URL-swap hack is fragile; needs cleanup.
				})
				.catch((error) => {
					console.error("createChat mutation failed", error);
					setChats((prev) => prev.filter((c) => c._id !== optimisticId));
					messagesCache.current.delete(optimisticId);
				});

			// Return optimistic id immediately for snappy navigation
			return optimisticId;
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

				// Remove parent link from any child chats in local state and Dexie
				setChats((prev) =>
					prev.map((c) =>
						c.parentChatId === chatId ? { ...c, parentChatId: undefined } : c,
					),
				);
				// Update dexie
				try {
					await db.chats
						.where("parentChatId")
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						.equals(chatId as any)
						.modify({ parentChatId: undefined });
				} catch {
					/* ignore */
				}

				console.log(
					`Deleted chat ${chatId} and ${messagesToDelete.length} messages`,
				);

				// If user is currently viewing this chat, redirect home
				if (
					typeof window !== "undefined" &&
					window.location.pathname.includes(chatId)
				) {
					routerRef.current.replace("/");
				}
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

			// Avoid server call if chatId still optimistic
			if (!chatId.startsWith(OPTIMISTIC_PREFIX)) {
				await updateChatModelMutation({
					chatId: chatId as Id<"chats">,
					model,
				});
			}

			await db.chats.update(chatId, { currentModel: model });
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
				// If chatId is still optimistic, skip Convex fetch but do check Dexie so
				// that a browser refresh still shows locally-saved messages.
				if (chatId.startsWith(OPTIMISTIC_PREFIX)) {
					const cached = messagesCache.current.get(chatId);
					if (cached) return cached;

					try {
						const localMessages = await db.messages
							.where("chatId")
							.equals(chatId)
							.toArray();

						if (localMessages.length > 0) {
							// ---- cleanup duplicate optimistic rows ----
							const hasRealRows = localMessages.some(
								(m) => !m._id.startsWith(OPTIMISTIC_PREFIX),
							);
							let cleaned = localMessages;
							if (hasRealRows) {
								const toDeleteIds = localMessages
									.filter((m) => m._id.startsWith(OPTIMISTIC_PREFIX))
									.map((m) => m._id);
								if (toDeleteIds.length > 0) {
									try {
										await db.messages.bulkDelete(toDeleteIds);
									} catch {}

									cleaned = localMessages.filter(
										(m) => !m._id.startsWith(OPTIMISTIC_PREFIX),
									);
								}
							}

							// Sort messages by creation time to ensure correct order
							const sortedMessages = cleaned.sort(
								(a, b) => a._creationTime - b._creationTime,
							);
							messagesCache.current.set(chatId, sortedMessages);
							memLRU.current.set(chatId, {
								ts: Date.now(),
								msgs: sortedMessages,
							});

							return sortedMessages;
						}
					} catch (err) {
						console.error("Dexie lookup failed for optimistic chat", err);
					}

					return [];
				}

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
			role: "user" | "assistant" | "system";
			content: string;
			model: string;
			attachments?: {
				name: string;
				url: string;
				contentType: string;
				size: number;
			}[];
			parentMessageId?: string;
			version?: number;
			isActive?: boolean;
			createdAt: number;
		}): Promise<string> => {
			// If this chatId has been resolved already, swap to real id immediately
			let targetChatId = messageData.chatId;
			const resolvedId = optimisticToRealChatId.current.get(targetChatId);
			if (resolvedId) {
				targetChatId = resolvedId;
			}

			const optimisticId = `${OPTIMISTIC_PREFIX}${Date.now()}-${Math.random()}`;
			const optimisticMessage: Message = {
				...messageData,
				_id: optimisticId,
				_creationTime: messageData.createdAt, // Use the provided createdAt time
				isActive: messageData.isActive ?? true,
				attachments: messageData.attachments,
			};

			const currentMessages = messagesCache.current.get(targetChatId) || [];
			// If regenerated assistant reply, optimistically deactivate previous versions in cache
			if (messageData.parentMessageId) {
				const parentId = messageData.parentMessageId;
				for (const msg of currentMessages) {
					if (msg._id === parentId || msg.parentMessageId === parentId) {
						msg.isActive = false;
					}
				}

				// dexie(fire and forget)
				try {
					const idsToPatch = currentMessages
						.filter((m) => m._id === parentId || m.parentMessageId === parentId)
						.map((m) => m._id as Id<"messages">);
					if (idsToPatch.length > 0) {
						void Promise.all(
							idsToPatch.map((id) =>
								db.messages.update(id, { isActive: false }),
							),
						).catch(() => {});
					}
				} catch {
					/* ignore */
				}
			}
			// Add the new message at the end (it should have the latest timestamp)
			const newMessages = [...currentMessages, optimisticMessage];
			// Sort to ensure proper order, but new messages should naturally be at the end
			const sortedMessages = newMessages.sort(
				(a, b) => a._creationTime - b._creationTime,
			);
			messagesCache.current.set(targetChatId, sortedMessages);

			// Update LRU cache immediately with the new message
			memLRU.current.set(targetChatId, {
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

			// Persist locally to Dexie even if chatId is still optimistic so the user
			// doesn't lose their branched history on refresh
			try {
				await db.messages.put(optimisticMessage);
			} catch {
				/* ignore dexie errors */
			}

			// Notify the messages provider immediately about the optimistic update
			onMessagesChangedCallback.current?.(targetChatId);

			try {
				// If chatId is still optimistic, delay server sync until realId exists
				let newMessageId: string | undefined;
				if (!targetChatId.startsWith(OPTIMISTIC_PREFIX)) {
					const convexData = {
						chatId: targetChatId as Id<"chats">,
						userId: messageData.userId,
						role: messageData.role,
						content: messageData.content,
						model: messageData.model,
						attachments: messageData.attachments,
						...(messageData.parentMessageId && {
							parentMessageId: messageData.parentMessageId as Id<"messages">,
						}),
						...(messageData.version && { version: messageData.version }),
					};
					newMessageId = await addMessageMutation(convexData);
				}

				if (newMessageId) {
					const realMessage = { ...optimisticMessage, _id: newMessageId };
					await db.messages.put(realMessage);
					// Remove the old optimistic record to avoid duplicates
					try {
						await db.messages.delete(optimisticId);
					} catch {
						/* ignore */
					}

					// Update cache ids
					const messages = messagesCache.current.get(targetChatId) || [];
					const updatedMessages = messages.map((msg) =>
						msg._id === optimisticId ? realMessage : msg,
					);
					messagesCache.current.set(targetChatId, updatedMessages);

					// Persist these messages to Dexie under the real chat id so they
					// survive a page refresh.
					try {
						await db.messages.bulkPut(updatedMessages);
					} catch {
						/* ignore */
					}
				}

				return newMessageId || optimisticId;
			} catch (error) {
				// Rollback: remove the optimistic message
				const messages = messagesCache.current.get(targetChatId) || [];
				const rolledBackMessages = messages.filter(
					(msg) => msg._id !== optimisticId,
				);
				messagesCache.current.set(targetChatId, rolledBackMessages);

				// Update LRU cache after rollback
				memLRU.current.set(targetChatId, {
					ts: Date.now(),
					msgs: rolledBackMessages,
				});

				// Notify about the rollback
				onMessagesChangedCallback.current?.(targetChatId);

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

				// ----- Update local caches so UI reflects the change immediately -----
				let chatIdOfMessage: string | null = null;
				for (const [chatId, msgs] of messagesCache.current.entries()) {
					if (msgs.some((m) => m._id === messageId)) {
						chatIdOfMessage = chatId;
						break;
					}
				}

				// Update in-memory and LRU caches
				if (chatIdOfMessage) {
					const msgs = messagesCache.current.get(chatIdOfMessage) || [];
					const patched = msgs.map((m) =>
						m._id === messageId ? { ...m, version: 1, isActive: false } : m,
					);
					messagesCache.current.set(chatIdOfMessage, patched);
					memLRU.current.set(chatIdOfMessage, {
						ts: Date.now(),
						msgs: patched,
					});

					// Persist to Dexie
					try {
						await db.messages.update(messageId, {
							version: 1,
							isActive: false,
						});
					} catch {
						/* ignore */
					}

					onMessagesChangedCallback.current?.(chatIdOfMessage);
				}
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
