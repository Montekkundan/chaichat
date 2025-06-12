import Dexie, { type Table } from "dexie";

export interface Chat {
	_id: string;
	name: string;
	userId: string;
	createdAt: number;
	currentModel: string;
	initialModel: string;
	_creationTime: number;
}

export interface Message {
	_id: string;
	chatId: string;
	userId: string;
	role: "user" | "assistant";
	content: string;
	model: string;
	createdAt: number;
	_creationTime: number;
	// Version fields for message versioning
	parentMessageId?: string;
	version?: number;
	isActive?: boolean;
}

export interface UserProfile {
	id: string;
	fullName: string;
	imageUrl: string;
}

export class ChaiChatDB extends Dexie {
	chats!: Table<Chat, string>;
	messages!: Table<Message, string>;
	users!: Table<UserProfile, string>;

	constructor() {
		super("ChaiChatDB");
		this.version(2).stores({
			chats: "_id, userId, name, createdAt, currentModel",
			messages: "_id, chatId, userId, createdAt, parentMessageId, version, isActive, model",
			users: "id, fullName",
		}).upgrade(tx => {
			// Migration for version 2
			return tx.table("messages").toCollection().modify(message => {
				if (message.isActive === undefined) {
					message.isActive = true;
				}
				// Ensure model field exists for existing messages
				if (!message.model) {
					message.model = "gpt-4o"; // Default model for existing messages
				}
			});
		});
	}
}

export const db = new ChaiChatDB();
