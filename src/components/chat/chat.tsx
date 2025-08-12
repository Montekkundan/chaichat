"use client";

import { useUser } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/server";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "~/components/chat-input/chat-input";
import type { UploadedFile } from "~/components/chat-input/file-items";
import { useChatHandlers } from "~/components/chat-input/use-chat-handlers";
import { Conversation } from "~/components/chat/conversation";
import { useMessages } from "~/lib/providers/messages-provider";

import { useSidebar } from "../ui/sidebar";

type ChatProps = { initialName?: string };

export default function Chat({ initialName }: ChatProps = {}) {
	const { chatId } = useParams();
	const { user } = useUser();
	const router = useRouter();
	const [isCreatingChat, setIsCreatingChat] = useState(false);
	const [hasNavigated, setHasNavigated] = useState(false);
	const [attachments, setAttachments] = useState<UploadedFile[]>([]);

	const conversationScrollApiRef = useRef<{
		scrollToBottom: () => void;
		getIsAtBottom: () => boolean;
	} | null>(null);

	const {
		messages,
		input,
		setInput,
		status,
		isSubmitting,
		selectedModel,
		setSelectedModel,
		sendMessage,
		createNewChat,
		stop,
		quotaExceeded,
		rateLimited,
	} = useMessages();

	const chatIdString = Array.isArray(chatId) ? chatId[0] : chatId;

	useEffect(() => {
		if (chatIdString && !hasNavigated) {
			setHasNavigated(true);
		}
	}, [chatIdString, hasNavigated]);

	// Determine if we should show onboarding (home page with no messages)
	const showOnboarding = !chatIdString && messages.length === 0;

	// // Determine if we should animate the input position
	// const shouldAnimateInput = hasNavigated || messages.length > 0;

	const { handleInputChange, handleModelChange, handleDelete, handleEdit } =
		useChatHandlers({
			messages,
			setMessages: () => {}, // Not needed with provider
			setInput,
			setSelectedModel,
			selectedModel,
			chatId: chatIdString || null,
			user: user as unknown as User | null,
		});

	const handleReload = async () => {
		// TODO: implement reload in provider if needed
	};

	const handleFileUpload = (files: UploadedFile[]) => {
		setAttachments((prev) => [...prev, ...files]);
	};

	const handleFileRemove = (file: UploadedFile) => {
		setAttachments((prev) => prev.filter((f) => f !== file));
	};

	const handleSend = async (
		attachmentFiles: UploadedFile[] = [],
		searchEnabled = false,
	) => {
		if (!input.trim() && attachmentFiles.length === 0) return;

		// Capture current data before we clear UI (optimistic)
		const messageToSend = input;
		const attToSend = attachmentFiles;

		// Optimistically clear UI for snappy feel
		setInput("");
		setAttachments([]);

		// If conversation is not at bottom, scroll down
		try {
			if (
				conversationScrollApiRef.current &&
				!conversationScrollApiRef.current.getIsAtBottom()
			) {
				conversationScrollApiRef.current.scrollToBottom();
			}
		} catch {}

		// If no chatId, create a new chat first (async)
		if (!chatIdString) {
			setIsCreatingChat(true);
			try {
				const newChatId = await createNewChat(messageToSend, selectedModel);
				// Navigate to the new chat; provider will send message automatically from query param
				router.push(
					`/chat/${newChatId}?q=${encodeURIComponent(messageToSend)}&model=${selectedModel}`,
				);
			} catch (error) {
				console.error("Failed to create chat:", error);
				// Revert UI on error
				setInput(messageToSend);
				setAttachments(attToSend);
			} finally {
				setIsCreatingChat(false);
			}
			return;
		}

		// Send message in existing chat (async, but UI already cleared)
		try {
			sendMessage(messageToSend, attToSend, searchEnabled);
		} catch (err) {
			console.error("Send message failed:", err);
			// On failure restore content so user can retry
			setInput(messageToSend);
			setAttachments(attToSend);
		}
	};

	const handleBranch = async (_idx: number) => {
		// TODO: Implement branch functionality if needed
		console.log("Branch not implemented yet");
	};

	const isLoading = isSubmitting || isCreatingChat || status === "streaming";

	const { state } = useSidebar();
	const _collapsed = state === "collapsed";

	return (
		<>
			<div className="pointer-events-none absolute bottom-0 z-10 w-full px-2">
				<div className="relative mx-auto flex w-full max-w-3xl flex-col text-center">
					<div className="pointer-events-none">
						<div className="pointer-events-auto">
							<div className="rounded-t-3xl p-2 pb-0 backdrop-blur-lg ">
								<ChatInput
									value={input}
									onValueChange={handleInputChange}
									onSend={handleSend}
									isSubmitting={isLoading}
									disabled={quotaExceeded || rateLimited}
									onSelectModel={handleModelChange}
									selectedModel={selectedModel}
									isUserAuthenticated={!!user?.id}
									stop={stop}
									status={status}
									files={attachments}
									onFileUpload={handleFileUpload}
									onFileRemove={handleFileRemove}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="absolute inset-0 sm:pt-3.5">
				{showOnboarding ? (
					<div className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pt-safe-offset-10 pb-10">
						<div className="flex h-[calc(100vh-20rem)] items-start justify-center">
							<div className="fade-in-50 zoom-in-95 w-full animate-in space-y-6 px-2 pt-[calc(max(15vh,2.5rem))] duration-300 sm:px-8">
								<h2 className="font-semibold text-3xl">
									How can I help you {user?.firstName ?? initialName ?? ""}?
								</h2>
							</div>
						</div>
					</div>
				) : (
					<div className="h-full min-h-0 w-full">
						<Conversation
							messages={messages}
							status={status}
							onDelete={handleDelete}
							onEdit={handleEdit}
							onReload={handleReload}
							onBranch={handleBranch}
							scrollButtonBottomClass="bottom-35 z-50 md:bottom-32"
							registerScrollApi={(api) => {
								conversationScrollApiRef.current = api;
							}}
						/>
					</div>
				)}
			</div>
		</>
	);
}
