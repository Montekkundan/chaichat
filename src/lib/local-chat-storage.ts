import { db } from "~/db";
import type { Chat, Message } from "~/db";
import { ChatTitlesCookieManager } from "./chat-titles-cookie";
import { userSessionManager } from "./user-session-manager";

export interface LocalChat extends Chat {
	id: string; // Alias for _id for consistency
}

export interface LocalMessage extends Omit<Message, "_id"> {
	_id: string;
}

export class LocalChatStorage {
	private static instance: LocalChatStorage;
	private isInitialized = false;

	static getInstance(): LocalChatStorage {
		if (!LocalChatStorage.instance) {
			LocalChatStorage.instance = new LocalChatStorage();
		}
		return LocalChatStorage.instance;
	}

	async initialize() {
		if (this.isInitialized) return;

		// Ensure database is ready
		await db.open();
		this.isInitialized = true;
	}

	async createChat(
		name: string,
		model: string,
		parentChatId?: string,
		userId?: string,
	): Promise<string> {
		await this.initialize();

		// Generate a unified ID that works for both logged and non-logged users
		const chatId = userSessionManager.generateUnifiedChatId();
		const storageUserId = userSessionManager.getStorageUserId(userId);

		const chat: LocalChat = {
			_id: chatId,
			id: chatId,
			name,
			userId: storageUserId,
			createdAt: Date.now(),
			currentModel: model,
			initialModel: model,
			parentChatId,
			_creationTime: Date.now(),
			isPublic: false,
		};

		await db.chats.add(chat as unknown as Chat);
		
		// Also save the title to cookies for server-side access
		ChatTitlesCookieManager.setChatTitle(chatId, name);
		
		return chatId;
	}

	async getChats(userId?: string): Promise<LocalChat[]> {
		await this.initialize();

		const targetUserId = userId || "local_user";

		const chats = await db.chats
			.where("userId")
			.equals(targetUserId)
			.reverse()
			.sortBy("createdAt");

		return chats.map((chat) => ({
			...chat,
			id: chat._id, // Ensure id field is set for consistency
		}));
	}

	async getChat(chatId: string, userId?: string): Promise<LocalChat | null> {
		await this.initialize();

		const targetUserId = userId || "local_user";

		const chat = await db.chats.get(chatId);

		if (!chat || chat.userId !== targetUserId) return null;

		return {
			...chat,
			id: chat._id, // Ensure id field is set for consistency
		};
	}

	async addMessage(
		chatId: string,
		role: "user" | "assistant" | "system",
		content: string,
		model: string,
		attachments?: {
			name: string;
			url: string;
			contentType: string;
			size: number;
		}[],
		userId?: string,
	): Promise<string> {
		await this.initialize();

		const storageUserId = userSessionManager.getStorageUserId(userId);

		const message: LocalMessage = {
			_id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			chatId,
			userId: storageUserId,
			role,
			content,
			model,
			createdAt: Date.now(),
			_creationTime: Date.now(),
			parentMessageId: undefined,
			version: 1,
			isActive: true,
			attachments: attachments || [],
		};

		await db.messages.add(message as unknown as Message);
		return message._id;
	}

	async getMessages(chatId: string, userId?: string): Promise<LocalMessage[]> {
		await this.initialize();

		const targetUserId = userId || "local_user";

		const messages = await db.messages
			.where("chatId")
			.equals(chatId)
			.and((message) => message.isActive !== false)
			.and((message) => message.userId === targetUserId)
			.sortBy("createdAt");

		return messages.map((message) => ({
			...message,
			_id: message._id,
		}));
	}

	async deleteChat(chatId: string): Promise<void> {
		await this.initialize();

		// Delete all messages for this chat
		await db.messages.where("chatId").equals(chatId).delete();

		// Delete the chat
		await db.chats.delete(chatId);
		
		// Also remove from cookies
		ChatTitlesCookieManager.removeChatTitle(chatId);
	}

	async updateChatName(chatId: string, name: string): Promise<void> {
		await this.initialize();

		await db.chats.update(chatId, { name });
		
		// Also update the title in cookies
		ChatTitlesCookieManager.setChatTitle(chatId, name);
	}

	async getRecentChats(limit = 3, userId?: string): Promise<LocalChat[]> {
		await this.initialize();

		const targetUserId = userId || "local_user";

		const chats = await db.chats
			.where("userId")
			.equals(targetUserId)
			.reverse()
			.sortBy("createdAt");

		return chats.slice(0, limit).map((chat) => ({
			...chat,
			id: chat._id, // Ensure id field is set for consistency
		}));
	}

	async getChatCount(userId?: string): Promise<number> {
		await this.initialize();

		const targetUserId = userId || "local_user";
		const count = await db.chats.where("userId").equals(targetUserId).count();

		return count;
	}

	async clearAllData(): Promise<void> {
		await this.initialize();

		// Clear all chats and messages
		await db.chats.clear();
		await db.messages.clear();
	}
}

export const localChatStorage = LocalChatStorage.getInstance();
