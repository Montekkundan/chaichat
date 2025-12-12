"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { ChatTitlesCookieManager } from "~/lib/chat-titles-cookie";
import { localChatStorage } from "~/lib/local-chat-storage";
import { useCache } from "~/lib/providers/cache-provider";

interface ChatTitleSyncerProps {
	chatId: string;
}

/**
 * Component that ensures chat titles are synced to cookies when a chat is loaded
 * This helps recover titles if cookies are cleared
 */
export function ChatTitleSyncer({ chatId }: ChatTitleSyncerProps) {
	const { user } = useUser();
	const cache = useCache();

	useEffect(() => {
		const syncChatTitle = async () => {
			try {
				// Check if we already have the title in cookies
				const existingTitle = ChatTitlesCookieManager.getChatTitle(chatId);
				if (existingTitle) {
					return; // Already have it, no need to fetch
				}

				// Try to get the title from our data sources
				let chatTitle: string | null = null;

				if (user) {
					// For logged-in users: check cache first, then Convex
					const cachedChat = cache.chats.find((c) => c._id === chatId);
					if (cachedChat?.name) {
						chatTitle = cachedChat.name;
					}
				} else {
					// For non-logged-in users: check local storage
					const localChat = await localChatStorage.getChat(chatId);
					if (localChat?.name) {
						chatTitle = localChat.name;
					}
				}

				// If we found a title, save it to cookies
				if (chatTitle) {
					ChatTitlesCookieManager.setChatTitle(chatId, chatTitle);
				}
			} catch (error) {
				console.warn("Failed to sync chat title:", error);
			}
		};

		if (chatId) {
			syncChatTitle();
		}
	}, [chatId, user, cache.chats]);

	return null;
}
