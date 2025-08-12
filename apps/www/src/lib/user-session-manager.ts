import { localChatStorage } from "./local-chat-storage";

// Unified chat ID format that works for both logged and non-logged users
export const UNIFIED_CHAT_PREFIX = "chat_";

// User session storage keys
const LAST_USER_ID_KEY = "chai_chat_last_user_id";
const SESSION_TIMESTAMP_KEY = "chai_chat_session_timestamp";

export interface UserSession {
	userId: string;
	timestamp: number;
	isLoggedIn: boolean;
}

export class UserSessionManager {
	private static instance: UserSessionManager;
	private currentSession: UserSession | null = null;

	static getInstance(): UserSessionManager {
		if (!UserSessionManager.instance) {
			UserSessionManager.instance = new UserSessionManager();
		}
		return UserSessionManager.instance;
	}

	// Generate unified chat ID that works for both logged and non-logged users
	generateUnifiedChatId(): string {
		return `${UNIFIED_CHAT_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	// Get current user session
	getCurrentSession(): UserSession | null {
		if (typeof window === "undefined") return null;

		if (!this.currentSession) {
			const lastUserId = localStorage.getItem(LAST_USER_ID_KEY);
			const timestamp = localStorage.getItem(SESSION_TIMESTAMP_KEY);

			if (lastUserId && timestamp) {
				this.currentSession = {
					userId: lastUserId,
					timestamp: Number.parseInt(timestamp),
					isLoggedIn: false,
				};
			}
		}

		return this.currentSession;
	}

	// Set current user session
	setCurrentSession(userId: string, isLoggedIn = false): void {
		if (typeof window === "undefined") return;

		this.currentSession = {
			userId,
			timestamp: Date.now(),
			isLoggedIn,
		};

		localStorage.setItem(LAST_USER_ID_KEY, userId);
		localStorage.setItem(
			SESSION_TIMESTAMP_KEY,
			this.currentSession.timestamp.toString(),
		);
	}

	// Clear current session
	clearSession(): void {
		if (typeof window === "undefined") return;

		this.currentSession = null;
		localStorage.removeItem(LAST_USER_ID_KEY);
		localStorage.removeItem(SESSION_TIMESTAMP_KEY);
	}

	// Check if the current user is the same as the last logged in user
	isSameUserAsLastSession(userId: string): boolean {
		const lastSession = this.getCurrentSession();
		return lastSession?.userId === userId;
	}

	// Handle user login - sync local data with Convex
	async handleUserLogin(userId: string): Promise<void> {
		const lastSession = this.getCurrentSession();

		if (lastSession && lastSession.userId === userId) {
			// Same user logging back in - sync local data to Convex
			await this.syncLocalToConvex(userId);
		} else {
			// Different user or first time login - clear local data and sync Convex to local
			await this.clearLocalAndSyncFromConvex(userId);
		}

		// Update session
		this.setCurrentSession(userId, true);
	}

	// Handle user logout - keep local data for continuity
	handleUserLogout(): void {
		const currentSession = this.getCurrentSession();
		if (currentSession) {
			// Keep the session but mark as not logged in
			this.setCurrentSession(currentSession.userId, false);
		}
	}

	// Sync local data to Convex (for same user logging back in)
	private async syncLocalToConvex(userId: string): Promise<void> {
		try {
			// Get all local chats and messages
			const localChats = await localChatStorage.getChats(userId);

			// TODO: Implement sync to Convex
			// This would involve:
			// 1. Getting all local chats for this user
			// 2. Getting all local messages for each chat
			// 3. Creating/updating chats in Convex
			// 4. Creating/updating messages in Convex
			// 5. Marking local data as synced

			console.log(
				"Syncing local data to Convex for user:",
				userId,
				"chats:",
				localChats.length,
			);
		} catch (error) {
			console.error("Failed to sync local data to Convex:", error);
		}
	}

	// Clear local data and sync from Convex (for different user)
	private async clearLocalAndSyncFromConvex(userId: string): Promise<void> {
		try {
			// Clear all local data
			await localChatStorage.clearAllData();

			// TODO: Implement sync from Convex
			// This would involve:
			// 1. Getting all chats from Convex for this user
			// 2. Getting all messages from Convex for each chat
			// 3. Storing them in local storage for faster access

			console.log(
				"Cleared local data and syncing from Convex for user:",
				userId,
			);
		} catch (error) {
			console.error("Failed to sync from Convex:", error);
		}
	}

	// Get the appropriate user ID for storage operations
	getStorageUserId(userId?: string): string {
		if (userId) {
			return userId;
		}

		const session = this.getCurrentSession();
		return session?.userId || "local_user";
	}
}

export const userSessionManager = UserSessionManager.getInstance();
