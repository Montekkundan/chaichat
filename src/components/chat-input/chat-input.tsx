"use client";
import { ArrowUp, Globe, Stop } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { generateReactHelpers } from "@uploadthing/react";
import { Paperclip } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { UploadRouter } from "~/app/api/uploadthing/core";
import { CookiePreferencesModal } from "~/components/modals/cookie-preferences-modal";
import { Button } from "~/components/ui/button";
import {
	PromptInput,
	PromptInputAction,
	PromptInputActions,
	PromptInputTextarea,
} from "~/components/ui/prompt-input";
import { toast } from "~/components/ui/toast";
import { filterValidFiles } from "~/lib/file-upload/validation";
import { getModelInfo } from "~/lib/models";
import { useQuota } from "~/lib/providers/quota-provider";
import { FileList } from "./file-list";
import { ModelSelector } from "./model-selector";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

type ChatInputProps = {
	value: string;
	onValueChange: (value: string) => void;
	onSend: (
		attachments: import("./file-items").UploadedFile[],
		isSearchEnabled: boolean,
		captchaToken?: string,
	) => void;
	isSubmitting?: boolean;
	hasMessages?: boolean;
	files: import("./file-items").UploadedFile[];
	onFileUpload: (files: import("./file-items").UploadedFile[]) => void;
	onFileRemove: (file: import("./file-items").UploadedFile) => void;
	// onSuggestion: (suggestion: string) => void
	// hasSuggestions?: boolean
	onSelectModel: (model: string) => void;
	selectedModel: string;
	isUserAuthenticated: boolean;
	stop: () => void;
	status?: "submitted" | "streaming" | "ready" | "error";
	disabled?: boolean;
	// onSearchToggle?: (enabled: boolean, agentId: string | null) => void
	position?: "centered" | "bottom";
};

// biome-ignore lint/suspicious/noExplicitAny: dynamic load of third-party module without types
const HCaptcha = dynamic<any>(() => import("@hcaptcha/react-hcaptcha"), {
	ssr: false,
});

export function ChatInput({
	value,
	onValueChange,
	onSend,
	isSubmitting,
	files,
	onFileUpload,
	onFileRemove,
	// onSuggestion,
	// hasSuggestions,
	onSelectModel,
	selectedModel,
	isUserAuthenticated,
	stop,
	status,
	// onSearchToggle,
	position = "centered",
	disabled = false,
}: ChatInputProps) {
	const selectModelConfig = getModelInfo(selectedModel);
	const hasToolSupport = Boolean(selectModelConfig?.tools);
	const allowWebSearch = ["openai", "google"].includes(
		selectModelConfig?.providerId ?? ""
	);

	// Helper to check if a string is only whitespace characters
	const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text);

	// Determine if the current model supports file/image attachments.
	// Prefer explicit `attachments` flag, otherwise fall back to models that have vision capability.
	const modelAllowsAttachments =
		selectModelConfig?.attachments ?? Boolean(selectModelConfig?.vision);

	// -------- UploadThing setup (must come before handlers that use startUpload) --------
	const uploadHelpers = generateReactHelpers<UploadRouter>();
	const { useUploadThing } = uploadHelpers;
	const { startUpload, isUploading } = useUploadThing("chatFiles");

	// Track files selected/pasted but not yet uploaded
	const pendingFilesRef = useRef<File[]>([]);

	// Handle paste events (defined after startUpload to avoid TS errors)
	const handlePaste = useCallback(
		async (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			const hasImageContent = Array.from(items).some((item) =>
				item.type.startsWith("image/"),
			);

			if (!isUserAuthenticated && hasImageContent) {
				e.preventDefault();
				return;
			}

			if (isUserAuthenticated && hasImageContent) {
				const imageFiles: File[] = [];

				for (const item of Array.from(items)) {
					if (item.type.startsWith("image/")) {
						const file = item.getAsFile();
						if (file) {
							const newFile = new File(
								[file],
								`pasted-image-${Date.now()}.${file.type.split("/")[1]}`,
								{ type: file.type },
							);
							imageFiles.push(newFile);
						}
					}
				}

				if (imageFiles.length > 0) {
					// Validate against limits and mime types
					const { validFiles, errors } = filterValidFiles(
						imageFiles,
						files.length,
					);
					if (errors.length) {
						toast({ title: errors.join("\n"), status: "error" });
					}

					if (validFiles.length === 0) return;

					// Create local preview objects and queue files
					const previews = validFiles.map((file) => {
						pendingFilesRef.current.push(file);
						return {
							name: file.name,
							url: URL.createObjectURL(file),
							contentType: file.type,
							size: file.size,
							local: true,
						} as import("./file-items").UploadedFile;
					});
					onFileUpload(previews);
				}
			}
		},
		[isUserAuthenticated, onFileUpload, files.length],
	);

	// Web search toggle state
	const [isSearchEnabled, setIsSearchEnabled] = useState(false);
	const toggleSearch = () => {
		setIsSearchEnabled((prev) => !prev);
	};

	// hCaptcha handling (anonymous users)
	const [showCaptcha, setShowCaptcha] = useState(false);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);

	const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "";

	const handleSend = useCallback(async () => {
		if (isSubmitting || disabled) {
			return;
		}

		if (status === "streaming") {
			stop();
			return;
		}

		// Anonymous users must solve captcha first (once per day)
		if (!isUserAuthenticated) {
			const hasCookie = document.cookie.includes("cc_captcha=1");
			if (!hasCookie && !captchaToken) {
				setShowCaptcha(true);
				return;
			}
		}

		// Prepare attachment list (defaults to current files prop)
		let attachmentsToSend: import("./file-items").UploadedFile[] = files;

		// First, upload any pending local files
		if (pendingFilesRef.current.length > 0) {
			try {
				const uploadRes = await startUpload(pendingFilesRef.current);
				if (!uploadRes) throw new Error("Upload failed");
				const uploaded = uploadRes.map(
					(r: { name: string; url: string }, idx: number) => ({
						name: r.name,
						url: r.url,
						contentType: pendingFilesRef.current[idx]?.type ?? "",
						size: pendingFilesRef.current[idx]?.size ?? 0,
					}),
				) as import("./file-items").UploadedFile[];

				const newList = files.filter((f) => !f.local).concat(uploaded);
				// Update Chat state so previews convert to real files
				onFileUpload(newList);
				// Point attachmentsToSend to the definitive uploaded list
				attachmentsToSend = newList;
			} catch (err) {
				console.error("Upload before send failed", err);
				toast({ title: "Upload failed", status: "error" });
				return; // abort send
			} finally {
				pendingFilesRef.current = [];
			}
		}

		onSend(attachmentsToSend, isSearchEnabled, captchaToken ?? undefined);

		// Reset captcha token after successful send
		if (captchaToken) {
			setCaptchaToken(null);
		}
	}, [
		isSubmitting,
		disabled,
		status,
		stop,
		onSend,
		startUpload,
		files,
		onFileUpload,
		isSearchEnabled,
		captchaToken,
		isUserAuthenticated,
	]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// First process agent command related key handling
			//   agentCommand.handleKeyDown(e)

			if (isSubmitting) {
				e.preventDefault();
				return;
			}

			if (e.key === "Enter" && status === "streaming") {
				e.preventDefault();
				return;
			}

			if (
				e.key === "Enter" &&
				!e.shiftKey /* && !agentCommand.showAgentCommand */
			) {
				if (isOnlyWhitespace(value) && files.length === 0) {
					return;
				}
				e.preventDefault();
				handleSend();
			}
		},
		[isSubmitting, status, value, files, handleSend],
	);

	// ---------------- Upload handling -----------------
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [showCookieModal, setShowCookieModal] = useState(false);
	const quota = useQuota();

	// Uploads are disabled either when the user is out of quota or when the selected model doesn't support attachments
	const fileQuotaExceeded = quota.stdCredits <= 0 && quota.premiumCredits <= 0;
	const uploadDisabled = fileQuotaExceeded || !modelAllowsAttachments;

	const handleLocalFileChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		if (uploadDisabled) return;
		if (!e.target.files) return;
		const rawFiles = Array.from(e.target.files);

		const { validFiles, errors } = filterValidFiles(rawFiles, files.length);
		if (errors.length) {
			toast({ title: errors.join("\n"), status: "error" });
		}

		if (validFiles.length === 0) {
			e.target.value = "";
			return;
		}

		// Store validated files locally and show previews
		const previews = validFiles.map((file) => {
			pendingFilesRef.current.push(file);
			return {
				name: file.name,
				url: URL.createObjectURL(file),
				contentType: file.type,
				size: file.size,
				local: true,
			} as import("./file-items").UploadedFile;
		});
		if (previews.length > 0) {
			onFileUpload(previews);
		}
		// reset input so same file can be selected again
		e.target.value = "";
	};

	const handleFileRemove = (file: import("./file-items").UploadedFile) => {
		onFileRemove(file);
		if (file.local) {
			pendingFilesRef.current = pendingFilesRef.current.filter(
				(f) => f.name !== file.name || f.size !== file.size,
			);
		}
	};

	const mainContent = (
		<div className="w-full max-w-3xl">
			<PromptInput
				className="relative z-10 bg-chat-background p-0 pt-1 shadow-xs backdrop-blur-xl"
				maxHeight={200}
				value={value}
				//   onValueChange={agentCommand.handleValueChange}
				disabled={disabled}
			>
				{/* {agentCommand.showAgentCommand && (
            <div className="absolute bottom-full left-0 w-full">
              <AgentCommand
                isOpen={agentCommand.showAgentCommand}
                searchTerm={agentCommand.agentSearchTerm}
                onSelect={agentCommand.handleAgentSelect}
                onClose={agentCommand.closeAgentCommand}
                activeIndex={agentCommand.activeAgentIndex}
                onActiveIndexChange={agentCommand.setActiveAgentIndex}
                curatedAgents={curatedAgents || []}
                userAgents={userAgents || []}
              />
            </div>
          )} */}
				{/* <SelectedAgent
            selectedAgent={agentCommand.selectedAgent}
            removeSelectedAgent={agentCommand.removeSelectedAgent}
          /> */}
				{modelAllowsAttachments && (
					<FileList files={files} onFileRemove={handleFileRemove} />
				)}
				<PromptInputTextarea
					placeholder="Ask ChaiChat"
					onKeyDown={handleKeyDown}
					onChange={(e) => onValueChange(e.target.value)}
					className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
					disabled={disabled || isSubmitting}
					// ref={agentCommand.textareaRef}
				/>
				<PromptInputActions className="mt-5 w-full justify-between px-3 pb-3">
					<div className="flex items-center gap-2">
						{/* Upload files */}
						{modelAllowsAttachments && (
							<PromptInputAction tooltip="Attach files">
								<label
									className={`flex h-8 w-8 items-center justify-center rounded-2xl ${uploadDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-muted/40"}`}
								>
									<input
										ref={fileInputRef}
										type="file"
										multiple
										onChange={handleLocalFileChange}
										className="hidden"
									/>
									{isUploading ? (
										<svg
											className="size-5 animate-spin text-primary"
											viewBox="0 0 24 24"
											aria-hidden="true"
										>
											<circle
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
												fill="none"
											/>
										</svg>
									) : (
										<Paperclip className="size-5 text-primary" />
									)}
								</label>
							</PromptInputAction>
						)}
						<ModelSelector
							selectedModelId={selectedModel}
							setSelectedModelId={onSelectModel}
							isUserAuthenticated={isUserAuthenticated}
							className="rounded-full"
						/>
						{allowWebSearch && (
							<PromptInputAction
								tooltip={isSearchEnabled ? "Disable search" : "Search"}
							>
								<Button
									variant={isSearchEnabled ? "secondary" : "outline"}
									size="sm"
									className="flex items-center gap-1 rounded-full px-2 py-1"
									onClick={toggleSearch}
								>
									<Globe size={18} />
									<motion.span
										initial={{ width: 0, opacity: 0 }}
										animate={isSearchEnabled ? { width: "auto", opacity: 1 } : { width: 0, opacity: 0 }}
										transition={{ type: "spring", duration: 0.2 }}
										className="overflow-hidden whitespace-nowrap text-xs"
									>
										Search
									</motion.span>
								</Button>
							</PromptInputAction>
						)}
					</div>
					<PromptInputAction tooltip={status === "streaming" ? "Stop" : "Send"}>
						<Button
							size="sm"
							className="size-9 rounded-full transition-all duration-300 ease-out"
							disabled={
								disabled ||
								isUploading ||
								(isOnlyWhitespace(value) && files.length === 0) ||
								isSubmitting
							}
							type="button"
							onClick={handleSend}
							aria-label={status === "streaming" ? "Stop" : "Send message"}
						>
							{status === "streaming" ? (
								<Stop className="size-4" />
							) : (
								<ArrowUp className="size-4" />
							)}
						</Button>
					</PromptInputAction>
				</PromptInputActions>
			</PromptInput>
			{position === "bottom" && (
				<>
					<div className="h-3" />
					<div className="select-none pb-1 text-center text-muted-foreground text-xs">
						ChaiChat can make mistakes. Check important info.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							onClick={() => setShowCookieModal(true)}
						>
							See Cookie Preferences.
						</button>
					</div>
					<CookiePreferencesModal
						open={showCookieModal}
						onOpenChange={setShowCookieModal}
					/>
				</>
			)}
		</div>
	);

	return (
		<>
			{mainContent}
			{showCaptcha && !isUserAuthenticated &&
				createPortal(
					<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
						<div className="rounded-md bg-background p-4">
							{siteKey ? (
								<HCaptcha
									sitekey={siteKey}
									onVerify={(token: string) => {
										// Store token
										setCaptchaToken(token);
										setShowCaptcha(false);
										setTimeout(() => {
											handleSend();
										}, 50);
									}}
									onError={() => {
										setShowCaptcha(false);
										toast({ title: "Captcha verification failed", status: "error" });
									}}
								/>
							) : (
								<p className="text-sm text-muted-foreground">Captcha site key not configured.</p>
							)}
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}
