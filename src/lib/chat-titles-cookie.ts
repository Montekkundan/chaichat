/**
 * Chat titles cookie management utility
 * Stores recent chat titles in cookies for server-side access
 */

export interface ChatTitleEntry {
	id: string;
	name: string;
	timestamp: number;
}

export class ChatTitlesCookieManager {
	private static readonly COOKIE_NAME = "cc_chat_titles";
	private static readonly MAX_ENTRIES = 50; // Store up to 50 recent chat titles
	private static readonly MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

	/**
	 * Get chat titles from cookies (server-side safe)
	 */
	static getChatTitles(cookieValue?: string): Map<string, string> {
		const titleMap = new Map<string, string>();

		if (!cookieValue) {
			return titleMap;
		}

		try {
			const entries: ChatTitleEntry[] = JSON.parse(
				decodeURIComponent(cookieValue),
			);
			if (Array.isArray(entries)) {
				const now = Date.now();
				entries.forEach((entry) => {
					// Only include non-expired entries
					if (now - entry.timestamp < ChatTitlesCookieManager.MAX_AGE) {
						titleMap.set(entry.id, entry.name);
					}
				});
			}
		} catch (error) {
			console.warn("Failed to parse chat titles cookie:", error);
		}

		return titleMap;
	}

	/**
	 * Add or update a chat title in cookies (client-side only)
	 */
	static setChatTitle(chatId: string, title: string): void {
		if (typeof window === "undefined") {
			return; // Server-side, can't set cookies
		}

		try {
			// Get existing titles
			const existingCookie = ChatTitlesCookieManager.getCookieValue();
			const titleMap = ChatTitlesCookieManager.getChatTitles(existingCookie);

			// Update or add the title
			titleMap.set(chatId, title);

			// Convert back to array format with timestamps
			const entries: ChatTitleEntry[] = Array.from(titleMap.entries()).map(
				([id, name]) => ({
					id,
					name,
					timestamp: Date.now(),
				}),
			);

			// Keep only the most recent entries
			entries.sort((a, b) => b.timestamp - a.timestamp);
			const trimmedEntries = entries.slice(
				0,
				ChatTitlesCookieManager.MAX_ENTRIES,
			);

			// Set the cookie
			const cookieValue = encodeURIComponent(JSON.stringify(trimmedEntries));
			const expires = new Date(
				Date.now() + ChatTitlesCookieManager.MAX_AGE,
			).toUTCString();

			document.cookie = `${ChatTitlesCookieManager.COOKIE_NAME}=${cookieValue}; expires=${expires}; path=/; SameSite=Lax`;
		} catch (error) {
			console.warn("Failed to set chat title cookie:", error);
		}
	}

	/**
	 * Get a specific chat title from cookies
	 */
	static getChatTitle(chatId: string, cookieValue?: string): string | null {
		const titleMap = ChatTitlesCookieManager.getChatTitles(cookieValue);
		return titleMap.get(chatId) || null;
	}

	/**
	 * Remove a chat title from cookies (client-side only)
	 */
	static removeChatTitle(chatId: string): void {
		if (typeof window === "undefined") {
			return; // Server-side, can't modify cookies
		}

		try {
			const existingCookie = ChatTitlesCookieManager.getCookieValue();
			const titleMap = ChatTitlesCookieManager.getChatTitles(existingCookie);

			titleMap.delete(chatId);

			// Convert back to array format
			const entries: ChatTitleEntry[] = Array.from(titleMap.entries()).map(
				([id, name]) => ({
					id,
					name,
					timestamp: Date.now(),
				}),
			);

			// Set the updated cookie
			const cookieValue = encodeURIComponent(JSON.stringify(entries));
			const expires = new Date(
				Date.now() + ChatTitlesCookieManager.MAX_AGE,
			).toUTCString();

			document.cookie = `${ChatTitlesCookieManager.COOKIE_NAME}=${cookieValue}; expires=${expires}; path=/; SameSite=Lax`;
		} catch (error) {
			console.warn("Failed to remove chat title from cookie:", error);
		}
	}

	/**
	 * Get the raw cookie value (client-side only)
	 */
	private static getCookieValue(): string | undefined {
		if (typeof window === "undefined") {
			return undefined;
		}

		const cookies = document.cookie.split(";");
		for (const cookie of cookies) {
			const [name, value] = cookie.trim().split("=");
			if (name === ChatTitlesCookieManager.COOKIE_NAME) {
				return value;
			}
		}
		return undefined;
	}

	/**
	 * Clear all chat titles from cookies (client-side only)
	 */
	static clearAllChatTitles(): void {
		if (typeof window === "undefined") {
			return;
		}

		document.cookie = `${ChatTitlesCookieManager.COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
	}
}
