import Dexie, { type Table } from "dexie";

export interface Chat {
	_id: string;
	name: string;
	userId: string;
	createdAt: number;
}

export interface Message {
	_id: string;
	chatId: string;
	userId: string;
	role: "user" | "assistant";
	content: string;
	createdAt: number;
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
		this.version(1).stores({
			chats: "_id, userId, name, createdAt",
			messages: "_id, chatId, userId, createdAt",
			users: "id, fullName",
		});
	}
}

export const db = new ChaiChatDB();
