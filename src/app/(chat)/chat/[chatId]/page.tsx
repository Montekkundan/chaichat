"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useChat } from "@ai-sdk/react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { MessageList } from "~/components/message-list";
import { PromptInputBox } from "~/components/prompt-input";
import { db } from '~/db';

export default function ChatPage() {
	const { chatId } = useParams();
	const { user } = useUser();
	const searchParams = useSearchParams();

	const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;
	const chatIdConvex = chatIdString as Id<"chats">;

	const convexMessages = useQuery(
		api.chat.getMessages,
		chatIdConvex ? { chatId: chatIdConvex } : "skip",
	);
	const addMessage = useMutation(api.chat.addMessage);

	const { messages, input, setInput, append, isLoading, setMessages } = useChat(
		{
			api: "/api/chat",
			initialMessages:
				convexMessages?.map((m) => ({
					id: m._id,
					role: m.role,
					content: m.content,
				})) ?? [],
			onFinish: (finalMessage) => {
				if (finalMessage.role === "assistant") {
					handleAssistantMessage(finalMessage.content);
				}
			},
		},
	);

	const pendingInput = searchParams.get("q");
	const hasAppendedPending = useRef(false);

	const handleSend = async (input: string) => {
		if (!input.trim() || !user) return;
		await addMessage({
			chatId: chatIdConvex,
			userId: user.id,
			role: "user",
			content: input,
		});
		await append({ content: input, role: "user" });
		setInput("");
	};

	const handleAssistantMessage = async (assistantContent: string) => {
		const alreadyInConvex = convexMessages?.some(
			m => m.role === "assistant" && m.content === assistantContent
		);
		if (!alreadyInConvex) {
			await addMessage({
				chatId: chatIdConvex,
				userId: "assistant",
				role: "assistant",
				content: assistantContent,
			});
			await db.messages.put({
				_id: crypto.randomUUID(),
				chatId: chatIdConvex,
				userId: "assistant",
				role: "assistant",
				content: assistantContent,
				createdAt: Date.now(),
			});
		}
	};

	useEffect(() => {
		if (convexMessages && messages.length === 0) {
			setMessages(
				convexMessages.map((m) => ({
					id: m._id,
					role: m.role,
					content: m.content,
				})),
			);
		}
	}, [convexMessages, messages.length, setMessages]);

	useEffect(() => {
		if (
			typeof window !== "undefined" &&
			pendingInput &&
			user &&
			!hasAppendedPending.current
		) {
			const last = messages[messages.length - 1];
			if (!last || last.content !== pendingInput) {
				append({ content: pendingInput, role: "user" });
				setInput("");
				hasAppendedPending.current = true;
				// Remove the query param from the URL after appending
				const url = new URL(window.location.href);
				url.searchParams.delete("q");
				window.history.replaceState({}, "", url.pathname + url.search);
			}
		}
	}, [pendingInput, user, messages, append, setInput]);

	// Sync Convex messages to Dexie on fetch
	useEffect(() => {
		if (convexMessages && convexMessages.length > 0) {
			// Remove all Dexie messages for this chatId before putting new ones
			db.messages.where('chatId').equals(chatIdConvex).delete().then(() => {
				db.messages.bulkPut(convexMessages);
			});
			const userIds = Array.from(new Set(convexMessages.map(m => m.userId)));
			Promise.all(userIds.map(async (id) => {
				if (!id || id === "assistant") return;
				const user = await db.users.get(id);
				if (!user) {
					try {
						const res = await fetch(`/api/clerk-user/${id}`);
						if (res.ok) {
							const profile = await res.json();
							await db.users.put(profile);
						}
					} catch {}
				}
			}));
		}
	}, [convexMessages, chatIdConvex]);

	// On load, try to load messages from Dexie for instant display
	useEffect(() => {
		let active = true;
		async function fetchLocalMessages() {
			if (chatIdConvex) {
				const localMessages = await db.messages.where('chatId').equals(chatIdConvex).toArray();
				localMessages.sort((a, b) => {
					const aTime = a.createdAt ?? (a as { _creationTime?: number })._creationTime ?? 0;
					const bTime = b.createdAt ?? (b as { _creationTime?: number })._creationTime ?? 0;
					return aTime - bTime;
				});
				if (active && localMessages.length > 0) {
					setMessages(localMessages.map((m) => ({ id: m._id, role: m.role, content: m.content })));
				}
			}
		}
		fetchLocalMessages();
		return () => { active = false; };
	}, [chatIdConvex, setMessages]);

	// Always use Convex as source of truth after initial load
	useEffect(() => {
		type ConvexMsg = { _id: string; role: string; content: string; _creationTime?: number };
		function isConvexMsg(m: unknown): m is ConvexMsg {
			return (
				typeof m === 'object' && m !== null &&
				'_id' in m && 'role' in m && 'content' in m
			);
		}
		if (convexMessages) {
			const unique = new Map();
			const mapped: ConvexMsg[] = convexMessages.filter(isConvexMsg).map(m => ({
				_id: m._id,
				role: m.role,
				content: m.content,
				_creationTime: (m as { _creationTime?: number })._creationTime,
			}));
			const sorted = mapped.sort((a, b) => {
				if (a._creationTime && b._creationTime) {
					return a._creationTime - b._creationTime;
				}
				return 0;
			});
			for (const m of sorted) {
				unique.set(m._id, { id: m._id, role: m.role, content: m.content });
			}
			setMessages(Array.from(unique.values()));
		}
	}, [convexMessages, setMessages]);

	const mappedMessages = messages.map((m, idx) => ({
		id: m.id ?? String(idx),
		role: m.role as "user" | "assistant",
		content: m.content,
	}));

	return (
		<div className="flex h-[calc(100vh-64px)] max-h-screen flex-col">
			<div className="flex-1 overflow-y-auto px-4 py-6">
				<MessageList
					messages={mappedMessages}
				/>
			</div>
			<div className="px-4 pb-4">
				<PromptInputBox
					value={input}
					onValueChange={setInput}
					onSubmit={handleSend}
					position="bottom"
					isLoading={isLoading}
				/>
			</div>
		</div>
	);
}
