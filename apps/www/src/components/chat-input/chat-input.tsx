"use client";
import { api } from "@/convex/_generated/api";
import { ArrowUp, Stop } from "@phosphor-icons/react";
import { generateReactHelpers } from "@uploadthing/react";
import { useAction } from "convex/react";
import { Settings as SettingsIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadRouter } from "~/app/api/uploadthing/core";
import { CookiePreferencesModal } from "~/components/modals/cookie-preferences-modal";
import { ModelConfigPanel } from "~/components/model-config/model-config";
import { Button } from "~/components/ui/button";
import { Button as UIButton } from "~/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	PromptInput,
	PromptInputAction,
	PromptInputActions,
	PromptInputTextarea,
} from "~/components/prompt-kit/prompt-input";
import { toast } from "~/components/ui/toast";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { filterValidFiles } from "~/lib/file-upload/validation";
import { useMessages } from "~/lib/providers/messages-provider";
import { FileList } from "./file-list";
import { ModelSelector } from "./model-selector";
import { cn } from "~/lib/utils";

// TODO cleanup: use all user keys

type UserKeys = {
    llmGatewayApiKey?: string;
    aiGatewayApiKey?: string;
};

type ChatInputProps = {
	value: string;
	onValueChange: (value: string) => void;
	onSend: (
		attachments: import("./file-items").UploadedFile[],
		isSearchEnabled: boolean,
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
	// Optional style overrides
	promptClassName?: string;
	textareaClassName?: string;
};

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
	promptClassName,
	textareaClassName,
}: ChatInputProps) {
	// const hasToolSupport = true; // Assume all models support tools via LLM Gateway

	// User keys state for search capabilities
	const getKeys = useAction(api.userKeys.getKeys);
  const [_userKeys, setUserKeys] = useState<UserKeys | undefined>(undefined);
  const [hasLlmKey, setHasLlmKey] = useState<boolean>(false);
  const [hasAiKey, setHasAiKey] = useState<boolean>(false);
  const [modelsSource, setModelsSource] = useState<"llmgateway" | "aigateway">(
    "llmgateway",
  );

	// Load user keys on mount
  useEffect(() => {
    const loadKeys = async () => {
      if (isUserAuthenticated) {
        const result = (await getKeys({})) as UserKeys;
        setUserKeys(result);
        setHasLlmKey(Boolean(result?.llmGatewayApiKey));
        setHasAiKey(Boolean(result?.aiGatewayApiKey));
      } else {
        try {
          const { getAllKeys } = await import("~/lib/local-keys");
          const localKeys = await getAllKeys();
          setUserKeys(localKeys);
          setHasLlmKey(Boolean(localKeys?.llmGatewayApiKey));
          setHasAiKey(Boolean(localKeys?.aiGatewayApiKey));
        } catch {
          setUserKeys({});
          setHasLlmKey(false);
          setHasAiKey(false);
        }
      }
    };

    loadKeys();
    const onKeysChanged = () => void loadKeys();
    window.addEventListener("apiKeysChanged", onKeysChanged);
    return () => window.removeEventListener("apiKeysChanged", onKeysChanged);
  }, [isUserAuthenticated, getKeys]);

  // Track current models source (global toggle in ModelSelector) to decide which key is required
  useEffect(() => {
    const readSource = () => {
      try {
        const raw = window.localStorage.getItem("chaichat_models_source");
        setModelsSource(raw === "aigateway" ? "aigateway" : "llmgateway");
      } catch {
        setModelsSource("llmgateway");
      }
    };
    readSource();
    const onChange = () => readSource();
    window.addEventListener("modelsSourceChanged", onChange as EventListener);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("modelsSourceChanged", onChange as EventListener);
      window.removeEventListener("storage", onChange);
    };
  }, []);

	// For now, enable search for all models - LLM Gateway will handle capabilities
	// const allowWebSearch = true;

	// Helper to check if a string is only whitespace characters
	const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text);

	// Determine if the current model supports file/image attachments.
	// Prefer explicit `attachments` flag, otherwise fall back to models that have vision capability.
	const supportsAttachments = true; // Assume all models support attachments via LLM Gateway	// -------- UploadThing setup (must come before handlers that use startUpload) --------
	const uploadHelpers = generateReactHelpers<UploadRouter>();
	const { useUploadThing } = uploadHelpers;
	const { startUpload, isUploading } = useUploadThing("chatFiles");


	// Track files selected/pasted but not yet uploaded
	const pendingFilesRef = useRef<File[]>([]);

	// Handle paste events (defined after startUpload to avoid TS errors)
	const _handlePaste = useCallback(
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
	const [isSearchEnabled, _setIsSearchEnabled] = useState(false);
	// const toggleSearch = () => {
	//   setIsSearchEnabled((prev) => !prev);
	// };

  // Derived: does the current source have the required key?
  const hasRequiredKey = modelsSource === "aigateway" ? hasAiKey : hasLlmKey;
    const handleSend = useCallback(async () => {
        // Streaming: call stop immediately (do not block on isSubmitting)
        if (status === "streaming") {
            // Always stop client-side consumption of the stream
            // even if the provider may not support server-side cancellation.
            stop();
            return;
        }

        if (isSubmitting || disabled) {
            return;
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

		onSend(attachmentsToSend, isSearchEnabled);
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
	const _fileInputRef = useRef<HTMLInputElement>(null);
	const [showCookieModal, setShowCookieModal] = useState(false);

	// Uploads are disabled when the selected model doesn't support attachments
	const uploadDisabled = !supportsAttachments;

	const _handleLocalFileChange = async (
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

	// Model configuration state from messages provider
	const { modelConfig, setModelConfig } = useMessages();
	const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);

	const mainContent = (
		<div className={cn("w-full max-w-3xl", "")}>
			<PromptInput
				className={cn(
					"relative z-10 bg-chat-background p-0 pt-1 shadow-xs backdrop-blur-xl",
					promptClassName,
				)}
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
				{supportsAttachments && (
					<FileList files={files} onFileRemove={handleFileRemove} />
				)}
                {!hasRequiredKey ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<div>
								<PromptInputTextarea
                          placeholder={`Please add your ${modelsSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key to start chatting`}
									onKeyDown={handleKeyDown}
									onChange={(e) => onValueChange(e.target.value)}
								className={cn(
									"min-h-[44px] cursor-not-allowed pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base",
									textareaClassName,
								)}
									disabled={true}
									// ref={agentCommand.textareaRef}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent side="top">
                      <div className="text-xs">Please add your {modelsSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key</div>
						</TooltipContent>
					</Tooltip>
				) : (
					<PromptInputTextarea
						placeholder="Ask ChaiChat"
						onKeyDown={handleKeyDown}
						onChange={(e) => onValueChange(e.target.value)}
						className={cn(
							"min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base",
							textareaClassName,
						)}
						disabled={disabled || isSubmitting}
						// ref={agentCommand.textareaRef}
					/>
				)}
                <PromptInputActions className="mt-5 w-full justify-between px-3 pb-3">
					<div className="flex items-center gap-2">
						{/* TODO: Implement file upload functionality */}
						{/* {supportsAttachments && (
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
						)} */}
						<ModelSelector
							selectedModelId={selectedModel}
							setSelectedModelId={onSelectModel}
							className="rounded-full"
						/>
						{/* Model Configuration popover */}
						<DropdownMenu
							open={isConfigMenuOpen}
							onOpenChange={(open) => {
								setIsConfigMenuOpen(open);
								if (open) {
									setTimeout(() => {
										const el = document.getElementById(
											"temperature",
										) as HTMLInputElement | null;
										el?.focus();
										el?.select?.();
									}, 0);
								}
							}}
						>
							<DropdownMenuTrigger asChild>
								<UIButton
									aria-label="Model Settings"
									variant={"ghost"}
									size={"icon"}
								>
									<span className="button_content__eYZtX button_flex___f_3o">
										<span className="pointer-events-none flex rounded-md p-2">
											<SettingsIcon className="h-4 w-4" />
										</span>
									</span>
								</UIButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-[420px]">
								<div className="space-y-2 p-2">
									<div className="px-1 font-semibold text-sm">
										Model Configuration
									</div>
									<ModelConfigPanel
										modelId={selectedModel}
										// Narrow typing to the shared shape
										// biome-ignore lint/suspicious/noExplicitAny: Component typing expects ChatColumn["config"]; runtime shape is compatible
										value={modelConfig as unknown as any}
										// biome-ignore lint/suspicious/noExplicitAny: See above note; we convert partials into provider setter
										onChange={(u: any) => setModelConfig(u)}
									/>
								</div>
							</DropdownMenuContent>
						</DropdownMenu>
						{/* TODO: Implement web search functionality */}
						{/* {allowWebSearch && (
							<PromptInputAction
								tooltip={isSearchEnabled ? "Disable web search" : "Enable web search"}
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
										animate={
											isSearchEnabled
												? { width: "auto", opacity: 1 }
												: { width: 0, opacity: 0 }
										}
										transition={{ type: "spring", duration: 0.2 }}
										className="overflow-hidden whitespace-nowrap text-xs"
									>
										Search
									</motion.span>
								</Button>
							</PromptInputAction>
						)} */}
					</div>
                    <PromptInputAction
                        tooltip={
                            !hasRequiredKey
                                ? `Please add your ${modelsSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key`
                                : status === "streaming"
                                    ? "Stop"
                                    : "Send"
                        }
                    >
                        {(() => {
                            const isStopPhase = status === "streaming";
                            const isButtonDisabled = isStopPhase
                                ? disabled || !hasRequiredKey
                                : disabled || !hasRequiredKey || isUploading || ((isOnlyWhitespace(value) && files.length === 0)) || isSubmitting;
                            const ariaLabel = isStopPhase ? "Stop" : "Send message";
                            return (
						<Button
							size="sm"
							className="size-9 rounded-full transition-all duration-300 ease-out"
                            disabled={isButtonDisabled}
							type="button"
							onClick={handleSend}
                            aria-label={ariaLabel}
						>
                            {isStopPhase ? (
								<Stop className="size-4" />
							) : (
								<ArrowUp className="size-4" />
							)}
						</Button>
                            );
                        })()}
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

	return <>{mainContent}</>;
}
