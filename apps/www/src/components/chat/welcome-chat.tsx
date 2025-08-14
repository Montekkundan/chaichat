"use client";

import { useUser } from "@clerk/nextjs";
import { useRef, useState } from "react";
import { ChatInput } from "~/components/chat-input/chat-input";
import { BackgroundSpace } from "~/components/background/starfield-canvas";
import type { UploadedFile } from "~/components/chat-input/file-items";
import { useMessages } from "~/lib/providers/messages-provider";
import { Suggestions, Suggestion } from "~/components/ai-elements/suggestion";

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
		<div className="relative mt-2 h-full w-full ">
			<BackgroundSpace />
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


