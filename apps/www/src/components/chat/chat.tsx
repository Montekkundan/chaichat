"use client";

import { useUser } from "@clerk/nextjs";
import type { User } from "@clerk/nextjs/server";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "~/components/chat-input/chat-input";
import type { UploadedFile } from "~/components/chat-input/file-items";
import { useChatHandlers } from "~/components/chat-input/use-chat-handlers";
import { Conversation } from "~/components/chat/conversation";
import { useMessages } from "~/lib/providers/messages-provider";
import { useLLMModels } from "~/hooks/use-models";
import { isStorageReady, modelSupportsVision } from "~/lib/model-capabilities";
import { toast } from "~/components/ui/toast";

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

	// Resolve current gateway from localStorage and keep in sync
	const [gateway, setGateway] = useState<"llm-gateway" | "vercel-ai-gateway">(
		"llm-gateway",
	);
	useEffect(() => {
		const read = () => {
			try {
				const src = window.localStorage.getItem("chaichat_models_source");
				setGateway(src === "aigateway" ? "vercel-ai-gateway" : "llm-gateway");
			} catch {
				setGateway("llm-gateway");
			}
		};
		read();
		const handler = () => read();
		window.addEventListener("modelsSourceChanged", handler as EventListener);
		window.addEventListener("storage", handler);
		return () => {
			window.removeEventListener(
				"modelsSourceChanged",
				handler as EventListener,
			);
			window.removeEventListener("storage", handler);
		};
	}, []);

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
			setMessages: () => { }, // Not needed with provider
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
		} catch { }

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

	// Global drag & drop overlay for full screen
	const [isDragOver, setIsDragOver] = useState(false);
	const [dragCounter, setDragCounter] = useState(0);
	const source = gateway === "vercel-ai-gateway" ? "aigateway" : "llmgateway";
	const { models } = useLLMModels({ source, controlled: true });
    const supportsAttachments = useMemo(() => {
        if (gateway === "vercel-ai-gateway") return true;
        try { return modelSupportsVision(models, selectedModel); } catch { return false; }
    }, [models, selectedModel, gateway]);
	const [storageReady, setStorageReady] = useState<{ ready: boolean; reason?: string }>({ ready: false });
	useEffect(() => {
		const compute = () => { try { setStorageReady(isStorageReady()); } catch { setStorageReady({ ready: false, reason: "Storage not configured" }); } };
		compute();
		const onKeysChanged = () => compute();
		const onStorageChanged = () => compute();
		window.addEventListener("apiKeysChanged", onKeysChanged);
		window.addEventListener("storageProviderChanged", onStorageChanged);
		window.addEventListener("storage", onStorageChanged);
		return () => {
			window.removeEventListener("apiKeysChanged", onKeysChanged);
			window.removeEventListener("storageProviderChanged", onStorageChanged);
			window.removeEventListener("storage", onStorageChanged);
		};
	}, []);

	const onDragEnter = (e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter((c) => c + 1);
		if (e.dataTransfer?.types.includes("Files")) setIsDragOver(true);
	};
	const onDragLeave = (e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter((c) => { const n = c - 1; if (n === 0) setIsDragOver(false); return n; });
	};
	const onDragOver = (e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
	};
	const onDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
		setDragCounter(0);
		if (!supportsAttachments) { toast({ title: "Selected model does not support image inputs", status: "error" }); return; }
		if (!storageReady.ready) { toast({ title: storageReady.reason || "Storage not configured", status: "error" }); return; }
		const droppedFiles = Array.from(e.dataTransfer.files || []);
		const images = droppedFiles.filter((f) => f.type?.startsWith("image/"));
		if (images.length === 0) { toast({ title: "Please drop image files only", status: "error" }); return; }
		window.dispatchEvent(new CustomEvent("externalFilesDropped", { detail: { files: images } }));
	};

	return (
		<div className="relative h-full w-full" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
			{isDragOver && (
				<div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
					<div className="rounded-2xl border-2 border-dashed border-primary/60 bg-background/70 p-6 text-primary shadow-xl">
						<div className="text-2xl mb-1 text-center">Drop images anywhere</div>
						<div className="text-sm text-center text-muted-foreground">JPEG, PNG, WebP, GIF</div>
					</div>
				</div>
			)}
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
								gateway={gateway}
							/>
						</div>
					)}
				</div>
			</>
		</div>
	);
}
