import Dexie, { type Table } from "dexie";

export interface Chat {
	_id: string;
	name: string;
	userId: string;
	createdAt: number;
	currentModel: string;
	initialModel: string;
	parentChatId?: string;
	_creationTime: number;
	isPublic: boolean;
}

export interface Message {
	_id: string;
	chatId: string;
	userId: string;
	role: "user" | "assistant" | "system";
	content: string;
	model: string;
	createdAt: number;
	_creationTime: number;
	// Version fields for message versioning
	parentMessageId?: string;
	version?: number;
	isActive?: boolean;
	attachments?: {
		name: string;
		url: string;
		contentType: string;
		size: number;
	}[];
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
		this.version(5)
			.stores({
				chats: "_id, userId, name, createdAt, currentModel, parentChatId, isPublic",
				messages:
					"_id, chatId, userId, createdAt, parentMessageId, version, isActive, model, attachments",
				users: "id, fullName",
			})
			.upgrade((tx) => {
				// Ensure message fields exist
				tx.table("messages")
					.toCollection()
					.modify((message) => {
						if (message.isActive === undefined) message.isActive = true;
						if (!message.model) message.model = "gpt-4o";
						if (message.attachments === undefined) message.attachments = [];
					});

				// Ensure new parentChatId field exists on chats
				tx.table("chats")
					.toCollection()
					.modify((chat) => {
						if (chat.parentChatId === undefined) chat.parentChatId = undefined;
						if (chat.isPublic === undefined) chat.isPublic = false;
					});
			});
	}
}

export const db = new ChaiChatDB();
