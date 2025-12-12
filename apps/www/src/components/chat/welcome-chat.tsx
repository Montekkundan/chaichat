"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatInput } from "~/components/chat-input/chat-input";
import { BackgroundSpace } from "~/components/background/starfield-canvas";
import type { UploadedFile } from "~/components/chat-input/file-items";
import { useMessages } from "~/lib/providers/messages-provider";
import { Suggestions, Suggestion } from "~/components/ai-elements/suggestion";
import { useLLMModels } from "~/hooks/use-models";
import { isStorageReady, modelSupportsVision } from "~/lib/model-capabilities";
import { toast } from "~/components/ui/toast";

// Background starfield moved to layout-level component

type WelcomeChatProps = { initialName?: string };

export default function WelcomeChat({ initialName: _initialName }: WelcomeChatProps = {}) {
	const { user } = useUser();
	const [attachments, setAttachments] = useState<UploadedFile[]>([]);

	const _conversationScrollApiRef = useRef<{
		scrollToBottom: () => void;
		getIsAtBottom: () => boolean;
	} | null>(null);

	const {
		input,
		setInput,
		status,
		isSubmitting,
		selectedModel,
		setSelectedModel,
		sendMessage,
		quotaExceeded,
		rateLimited,
	} = useMessages();

	const handleFileUpload = (files: UploadedFile[]) => {
		setAttachments((prev) => [...prev, ...files]);
	};

	const handleFileRemove = (file: UploadedFile) => {
		setAttachments((prev) => prev.filter((f) => f !== file));
	};

	const handleSend = async (
		attachmentFiles: UploadedFile[] = [],
		_searchEnabled = false,
	) => {
		if (!input.trim() && attachmentFiles.length === 0) return;

		const messageToSend = input;
		const attToSend = attachmentFiles;

		setInput("");
		setAttachments([]);

		try {
			// Provider handles creating a new chat and routing when no chatId is present
			sendMessage(messageToSend, attToSend, _searchEnabled);
		} catch {
			// Restore input so user can retry
			setInput(messageToSend);
			setAttachments(attToSend);
		}
	};

	const isLoading = isSubmitting || status === "streaming";

	// Global drag & drop for full screen
	const [isDragOver, setIsDragOver] = useState(false);
	const [dragCounter, setDragCounter] = useState(0);
    const { models } = useLLMModels();
    const supportsAttachments = useMemo(() => {
        try {
            // TODO: Allow attachments for AI Gateway regardless of model metadata until modalities are exposed
            const src = typeof window !== "undefined" ? window.localStorage.getItem("chaichat_models_source") : null;
            if (src === "aigateway") return true;
            return modelSupportsVision(models, selectedModel);
        } catch {
            return false;
        }
    }, [models, selectedModel]);
	const [storageReady, setStorageReady] = useState<{ ready: boolean; reason?: string }>({ ready: false });
	useEffect(() => {
		const compute = () => {
			try { setStorageReady(isStorageReady()); } catch { setStorageReady({ ready: false, reason: "Storage not configured" }); }
		};
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

	const handleDragEnter = (e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter((c) => c + 1);
		if (e.dataTransfer?.types.includes("Files")) setIsDragOver(true);
	};
	const handleDragLeave = (e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter((c) => {
			const n = c - 1;
			if (n === 0) setIsDragOver(false);
			return n;
		});
	};
	const handleDragOver = (e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
	};
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
		setDragCounter(0);
		if (!supportsAttachments) {
			toast({ title: "Selected model does not support image inputs", status: "error" });
			return;
		}
		if (!storageReady.ready) {
			toast({ title: storageReady.reason || "Storage not configured", status: "error" });
			return;
		}
		const droppedFiles = Array.from(e.dataTransfer.files || []);
		const images = droppedFiles.filter((f) => f.type?.startsWith("image/"));
		if (images.length === 0) {
			toast({ title: "Please drop image files only", status: "error" });
			return;
		}
		const event = new CustomEvent("externalFilesDropped", { detail: { files: images } });
		window.dispatchEvent(event);
	};

	// Background handled globally in layout; no local fog/Canvas state

	const suggestionItems = [
		"What is the meaning of life?",
		"Explain the theory of relativity",
		"What are the different AI architectures?",
	];

	const handleSuggestionClick = (suggestion: string) => {
		if (!suggestion.trim()) return;
		setInput("");
		setAttachments([]);
		try {
			sendMessage(suggestion, [], false);
		} catch {
			setInput(suggestion);
		}
	};

	return (
		<div
			className="relative mt-2 h-full w-full "
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<BackgroundSpace />
			{isDragOver && (
				<div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
					<div className="rounded-2xl border-2 border-dashed border-primary/60 bg-background/70 p-6 text-primary shadow-xl">
						<div className="text-2xl mb-1 text-center">Drop images anywhere</div>
						<div className="text-sm text-center text-muted-foreground">JPEG, PNG, WebP, GIF</div>
					</div>
				</div>
			)}
			<div className="absolute inset-0 flex items-center justify-center px-4">
				<div className="w-full max-w-3xl animate-in zoom-in-95 fade-in-50 duration-300 space-y-6 sm:px-4">
					<h2 className="text-center font-black text-8xl text-muted-foreground opacity-50 translate-y-12">
						Experiment
					</h2>
					<div className="relative z-10 mx-auto flex w-full max-w-3xl justify-center">
						{/* Foreground chat input with glassy border */}
						<ChatInput
							value={input}
							onValueChange={setInput}
							onSend={handleSend}
							isSubmitting={isLoading}
							disabled={quotaExceeded || rateLimited}
							onSelectModel={setSelectedModel}
							selectedModel={selectedModel}
							isUserAuthenticated={!!user?.id}
							stop={() => { }}
							status={status}
							files={attachments}
							onFileUpload={handleFileUpload}
							onFileRemove={handleFileRemove}
							position="centered"
							promptClassName="rounded-3xl border-glass bg-background/10 shadow-lg"
						/>
					</div>
					{/* Suggestions row below the input */}
					<div className="mx-auto w-full max-w-3xl">
						<Suggestions className="mt-3 px-1">
							{suggestionItems.map((s) => (
								<Suggestion key={s} suggestion={s} onClick={handleSuggestionClick} />
							))}
						</Suggestions>
					</div>
				</div>
			</div>
		</div>
	);
}
