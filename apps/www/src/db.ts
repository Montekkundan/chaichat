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
	modelConfigJson?: string;
}

export interface Message {
	_id: string;
	chatId: string;
	userId: string;
	role: "user" | "assistant" | "system";
	content: string;
	// full message parts including reasoning/tool calls, not just text content.
	partsJson?: string;
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
	gateway?: "llm-gateway" | "vercel-ai-gateway";
}

export interface UserProfile {
	id: string;
	fullName: string;
	imageUrl: string;
}

export interface Playground {
	_id: string; // playground id (e.g., playground-...)
	userId: string;
	name: string;
	createdAt: number;
	columns: {
		id: string;
		modelId: string;
		gatewaySource?: "aigateway" | "llmgateway";
	}[];
}

export interface PlaygroundMessage {
	_id: string;
	playgroundId: string;
	columnId: string;
	userId: string;
	role: "user" | "assistant" | "system";
	content: string;
	model: string;
	createdAt: number;
	_creationTime: number;
	gateway?: "llm-gateway" | "vercel-ai-gateway";
}

// Flow graph persistence (local IndexedDB)
export interface Flow {
  _id: string;
  userId: string;
  name: string;
  createdAt: number;
}

export interface FlowNodeRecord {
  _id: string;
  flowId: string;
  type: string;
  position: { x: number; y: number };
  dataJson: string; // arbitrary node data serialized
  createdAt: number;
}

export interface FlowEdgeRecord {
  _id: string;
  flowId: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  dataJson?: string;
  createdAt: number;
}

export class ChaiChatDB extends Dexie {
	chats!: Table<Chat, string>;
	messages!: Table<Message, string>;
	users!: Table<UserProfile, string>;
	playgrounds!: Table<Playground, string>;
	playgroundMessages!: Table<PlaygroundMessage, string>;
  flows!: Table<Flow, string>;
  flowNodes!: Table<FlowNodeRecord, string>;
  flowEdges!: Table<FlowEdgeRecord, string>;

	constructor() {
		super("ChaiChatDB");
    this.version(10)
			.stores({
				chats:
					"_id, userId, name, createdAt, currentModel, parentChatId, isPublic",
				messages:
					"_id, chatId, userId, createdAt, parentMessageId, version, isActive, model, attachments, partsJson, gateway",
				users: "id, fullName",
				playgrounds: "_id, userId, createdAt",
				playgroundMessages:
					"_id, playgroundId, columnId, userId, createdAt, model, gateway",
        flows: "_id, userId, createdAt",
        flowNodes: "_id, flowId, type, createdAt",
        flowEdges: "_id, flowId, createdAt",
			})
			.upgrade((tx) => {
				// Ensure message fields exist
				tx.table("messages")
					.toCollection()
					.modify((message) => {
						if (message.isActive === undefined) message.isActive = true;
						if (!message.model) message.model = "gpt-4o";
						if (message.attachments === undefined) message.attachments = [];
						if (message.partsJson === undefined) message.partsJson = undefined;
						if (message.gateway === undefined) message.gateway = undefined;
					});

				// Ensure new parentChatId field exists on chats
				tx.table("chats")
					.toCollection()
					.modify((chat) => {
						if (chat.parentChatId === undefined) chat.parentChatId = undefined;
						if (chat.isPublic === undefined) chat.isPublic = false;
					});
				// Ensure gateway on playgroundMessages
				tx.table("playgroundMessages")
					.toCollection()
					.modify((msg) => {
						if (msg.gateway === undefined) msg.gateway = undefined;
					});

        // Initialize flows containers if not present (no-op placeholder)
        try {
          void tx.table("flows");
          void tx.table("flowNodes");
          void tx.table("flowEdges");
        } catch {}
			});
	}
}

export const db = new ChaiChatDB();
