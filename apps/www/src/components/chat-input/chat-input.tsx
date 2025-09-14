"use client";
import { api } from "@/convex/_generated/api";
import { ArrowUp, Paperclip, Stop } from "@phosphor-icons/react";
import { generateReactHelpers } from "@uploadthing/react";
import { useAction } from "convex/react";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadRouter } from "~/app/api/uploadthing/core";
import { CookiePreferencesModal } from "~/components/modals/cookie-preferences-modal";
import { UnifiedConfigSheet } from "~/components/model-config";
import {
	PromptInput,
	PromptInputAction,
	PromptInputActions,
	PromptInputTextarea,
} from "~/components/prompt-kit/prompt-input";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/toast";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { filterValidFiles } from "~/lib/file-upload/validation";
import { useMessages } from "~/lib/providers/messages-provider";
import { cn } from "~/lib/utils";
import { FileList } from "./file-list";
import { ModelSelector } from "./model-selector";
import { useLLMModels } from "~/hooks/use-models";
import { isStorageReady, modelSupportsVision } from "~/lib/model-capabilities";
import { Globe } from "lucide-react";

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
			window.removeEventListener(
				"modelsSourceChanged",
				onChange as EventListener,
			);
			window.removeEventListener("storage", onChange);
		};
	}, []);

	// Track storage provider
	const [storageProvider, setStorageProvider] = useState<"uploadthing" | "vercelblob">("uploadthing");
	useEffect(() => {
		const readStorageProvider = () => {
			try {
				const raw = window.localStorage.getItem("chai-storage-provider");
				setStorageProvider(raw === "vercelblob" ? "vercelblob" : "uploadthing");
			} catch {
				setStorageProvider("uploadthing");
			}
		};
		readStorageProvider();
		const onChange = () => readStorageProvider();
		window.addEventListener("storageProviderChanged", onChange);
		window.addEventListener("storage", onChange);
		return () => {
			window.removeEventListener("storageProviderChanged", onChange);
			window.removeEventListener("storage", onChange);
		};
	}, []);

	// For now, enable search for all models - LLM Gateway will handle capabilities
	// const allowWebSearch = true;

	// Helper to check if a string is only whitespace characters
	const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text);

	// Determine if selected model supports image inputs
    const { models } = useLLMModels({
        source: modelsSource === "aigateway" ? "aigateway" : "llmgateway",
        controlled: true,
    });
    // TODO: Allow attachments for AI Gateway regardless of model metadata until modalities are exposed
    const supportsAttachments = modelsSource === "aigateway" ? true : modelSupportsVision(models, selectedModel);

	const uploadHelpers = generateReactHelpers<UploadRouter>();
	const { useUploadThing } = uploadHelpers;
	const { startUpload, isUploading } = useUploadThing("chatFiles");

	// File input ref for manual file selection
	const fileInputRef = useRef<HTMLInputElement>(null);

	const uploadFile = useCallback(async (file: File): Promise<{ url: string; name: string; size: number; contentType: string } | null> => {
		if (storageProvider === "vercelblob") {
			// Upload to Vercel Blob
			const formData = new FormData();
			formData.append("file", file);

			// Get localStorage keys to pass to the API
			const localKeys = {
				llmGatewayApiKey: localStorage.getItem("chaichat_keys_llmgateway") || undefined,
				aiGatewayApiKey: localStorage.getItem("chaichat_keys_aigateway") || undefined,
				uploadThingApiKey: localStorage.getItem("chaichat_keys_uploadthing") || undefined,
				vercelBlobApiKey: localStorage.getItem("chaichat_keys_vercelblob") || undefined,
				storageProvider: localStorage.getItem("chai-storage-provider") || "uploadthing",
			};

			const response = await fetch("/api/upload/vercel-blob", {
				method: "POST",
				body: formData,
				headers: {
					"X-Local-Keys": JSON.stringify(localKeys),
				},
			});

			if (response.ok) {
				const data = await response.json();
				return {
					url: data.file.url,
					name: data.file.name,
					size: data.file.size,
					contentType: data.file.contentType,
				};
			}
			const error = await response.json();
			throw new Error(error.error || "Failed to upload to Vercel Blob");
		}

		// Upload to UploadThing
		const uploadResult = await startUpload([file]);
		if (uploadResult?.[0]) {
			const uploadedFile = uploadResult[0];
			// Prefer ufsUrl when available (UploadThing v9+)
			// biome-ignore lint/suspicious/noExplicitAny: upstream client type
			const anyFile = uploadedFile as any;
			const finalUrl = typeof anyFile.ufsUrl === 'string' && anyFile.ufsUrl.length > 0 ? anyFile.ufsUrl : uploadedFile.url;
			return {
				url: finalUrl,
				name: uploadedFile.name || file.name,
				size: uploadedFile.size || file.size,
				contentType: file.type,
			};
		}
		throw new Error("Failed to upload to UploadThing");
	}, [storageProvider, startUpload]);

	// Track files selected/pasted but not yet uploaded
	const pendingFilesRef = useRef<File[]>([]);

	const [isDragOver, setIsDragOver] = useState(false);
	const [_dragCounter, setDragCounter] = useState(0);

	// Track storage readiness from keys + explicit provider selection
	const [storageReady, setStorageReady] = useState<{ ready: boolean; reason?: string }>({ ready: false });
	useEffect(() => {
		const compute = () => {
			try {
				setStorageReady(isStorageReady());
			} catch {
				setStorageReady({ ready: false, reason: "Storage not configured" });
			}
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

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter(prev => prev + 1);
		if (e.dataTransfer?.types.includes('Files')) {
			setIsDragOver(true);
		}
	}, [supportsAttachments, storageReady.ready]);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter(prev => {
			const newCounter = prev - 1;
			if (newCounter === 0) {
				setIsDragOver(false);
			}
			return newCounter;
		});
	}, [supportsAttachments, storageReady.ready]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		if (!supportsAttachments || !storageReady.ready) return;
		e.preventDefault();
		e.stopPropagation();
	}, [supportsAttachments, storageReady.ready]);

	const handleDrop = useCallback(async (e: React.DragEvent) => {
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

		const droppedFiles = Array.from(e.dataTransfer.files);
		if (droppedFiles.length === 0) return;

		// Filter for image files only
		const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));

		if (imageFiles.length === 0) {
			toast({ title: "Please drop image files only", status: "error" });
			return;
		}

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
	}, [supportsAttachments, storageReady, onFileUpload, files.length]);

	// Accept external image drops (from page-level overlays)
	useEffect(() => {
		const handler = (ev: Event) => {
			try {
				const ce = ev as CustomEvent<{ files: File[] }>;
				const filesArr = Array.isArray(ce.detail?.files) ? ce.detail.files : [];
				if (!supportsAttachments || !storageReady.ready) return;
				const images = filesArr.filter((f) => f.type?.startsWith("image/"));
				if (images.length === 0) return;
				const { validFiles, errors } = filterValidFiles(images, files.length);
				if (errors.length) toast({ title: errors.join("\n"), status: "error" });
				if (validFiles.length === 0) return;
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
			} catch { }
		};
		window.addEventListener("externalFilesDropped", handler as EventListener);
		return () => window.removeEventListener("externalFilesDropped", handler as EventListener);
	}, [supportsAttachments, storageReady, onFileUpload, files.length]);

	// Web search toggle state
	const [isSearchEnabled, setIsSearchEnabled] = useState(false);
	useEffect(() => {
		try { setIsSearchEnabled(localStorage.getItem("chaichat_search_enabled") === "true"); } catch {}
		const onKeys = () => { /* reflect readiness elsewhere if desired */ };
		window.addEventListener("apiKeysChanged", onKeys);
		return () => window.removeEventListener("apiKeysChanged", onKeys);
	}, []);
	const toggleSearch = () => {
		setIsSearchEnabled((prev) => {
			const next = !prev;
			try { localStorage.setItem("chaichat_search_enabled", next ? "true" : "false"); } catch {}
			return next;
		});
	};

	// Determine if search can be enabled based on provider and key presence
	const [searchAllowed, setSearchAllowed] = useState<{ allowed: boolean; reason?: string }>({ allowed: false });
	useEffect(() => {
		try {
			const sp = localStorage.getItem("chai-search-provider");
			const hasExa = !!localStorage.getItem("chaichat_keys_exa");
			const hasFirecrawl = !!localStorage.getItem("chaichat_keys_firecrawl");
			if (sp === "exa") setSearchAllowed(hasExa ? { allowed: true } : { allowed: false, reason: "Set Exa API key" });
			else if (sp === "firecrawl") setSearchAllowed(hasFirecrawl ? { allowed: true } : { allowed: false, reason: "Set Firecrawl API key" });
			else setSearchAllowed({ allowed: false, reason: "Pick a search provider" });
		} catch { setSearchAllowed({ allowed: false, reason: "Configure web search" }); }
	}, [modelsSource]);

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

		const inputValue = value.trim();

		// Check for image generation commands
		// TODO: we should not need patterns for this
		const imageGenPatterns = [
			/^\/generate\s+(.+)$/i,
			/^\/image\s+(.+)$/i,
			/^\/img\s+(.+)$/i,
			/^\/dalle\s+(.+)$/i,
		];

		let imagePrompt: string | null = null;
		for (const pattern of imageGenPatterns) {
			const match = inputValue.match(pattern);
			if (match && typeof match[1] === "string") {
				imagePrompt = match[1].trim();
				break;
			}
		}

		if (imagePrompt) {
			// Handle image generation
			try {
				// Note: isSubmitting is handled by the parent component

				// Get localStorage keys to pass to the API
				const localKeys = {
					llmGatewayApiKey: localStorage.getItem("chaichat_keys_llmgateway") || undefined,
					aiGatewayApiKey: localStorage.getItem("chaichat_keys_aigateway") || undefined,
					uploadThingApiKey: localStorage.getItem("chaichat_keys_uploadthing") || undefined,
					vercelBlobApiKey: localStorage.getItem("chaichat_keys_vercelblob") || undefined,
					storageProvider: localStorage.getItem("chai-storage-provider") || "uploadthing",
				};

				const response = await fetch("/api/chat", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Local-Keys": JSON.stringify(localKeys),
					},
					body: JSON.stringify({
						imageGeneration: {
							prompt: imagePrompt,
							size: "1024x1024",
							model: selectedModel.includes("dall-e") ? selectedModel : "openai/dall-e-3",
							n: 1,
						},
						gateway: modelsSource === "aigateway" ? "vercel-ai-gateway" : "llm-gateway",
					}),
				});

				if (response.ok) {
					const result = await response.json();
					if (result.images && result.images.length > 0) {
						// Convert generated images to attachment format
						const generatedAttachments = result.images.map((img: { name: string; url: string; contentType: string; size: number }) => ({
							name: img.name,
							url: img.url,
							contentType: img.contentType,
							size: img.size,
							local: false,
						})) as import("./file-items").UploadedFile[];

						// Add generated images to the attachments
						onFileUpload([...files, ...generatedAttachments]);

						toast({
							title: `Generated ${result.images.length} image(s)`,
							status: "success"
						});

						// Clear the input
						onValueChange("");
					} else {
						toast({ title: "No images were generated", status: "error" });
					}
				} else {
					const error = await response.json();
					toast({
						title: "Image generation failed",
						description: error.details || error.error,
						status: "error"
					});
				}
			} catch (err) {
				console.error("Image generation error:", err);
				toast({ title: "Failed to generate image", status: "error" });
			}
			return;
		}

		// Prepare attachment list (defaults to current files prop)
		let attachmentsToSend: import("./file-items").UploadedFile[] = files;

		// Collect all local files that need to be uploaded
		const localFilesFromPending = pendingFilesRef.current;
		const localFilesFromProps = files.filter(f => f.local === true);

		console.log('Local files from pending:', localFilesFromPending.length);
		console.log('Local files from props:', localFilesFromProps.length);

		// Convert local UploadedFile objects to File objects for upload
		const filesToUpload: File[] = [];

		// Only use files from pendingFilesRef to avoid duplicates
		// The files prop should contain the same files after they're uploaded
		filesToUpload.push(...localFilesFromPending);

		// Upload any local files
		if (filesToUpload.length > 0) {
			try {
				console.log(`Uploading ${filesToUpload.length} files`);
				const uploadPromises = filesToUpload.map(file => uploadFile(file));
				const uploadResults = await Promise.all(uploadPromises);

				const uploaded = uploadResults
					.filter((result): result is NonNullable<typeof result> => result !== null)
					.map(result => ({
						name: result.name,
						url: result.url,
						contentType: result.contentType,
						size: result.size,
					})) as import("./file-items").UploadedFile[];

				console.log('Upload results:', uploaded);

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
		files,
		onFileUpload,
		isSearchEnabled,
		value,
		onValueChange,
		selectedModel,
		modelsSource,
		uploadFile,
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
	const [showCookieModal, setShowCookieModal] = useState(false);

	// Handle manual file selection via click
	const handleLocalFileChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		if (!supportsAttachments || !e.target.files) return;
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

	// Disable when model doesn't support images or storage unavailable
	const uploadDisabled = !supportsAttachments || !storageReady.ready;



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

	const mainContent = (
		<div
			className={cn(
				"w-full max-w-3xl relative",
				// isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{/* Drag overlay */}
			{isDragOver && (
				<div className="absolute inset-0 z-20 bg-primary/10 backdrop-blur-sm rounded-t-2xl border-2 border-dashed border-primary flex items-center justify-center">
					<div className="text-center text-primary">
						<div className="font-medium">Drop images here</div>
						<div className="text-sm text-muted-foreground">Supported: JPEG, PNG, WebP, GIF</div>
					</div>
				</div>
			)}
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
							<div className="text-xs">
								Please add your{" "}
								{modelsSource === "aigateway"
									? "Vercel AI Gateway"
									: "LLM Gateway"}{" "}
								API key
							</div>
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
						<PromptInputAction
							tooltip={
								!supportsAttachments
									? "Selected model doesn’t support image inputs"
									: !storageReady.ready
										? storageReady.reason || "Configure storage to upload images"
										: "Attach files"
							}
						>
							<label
								htmlFor="file-upload"
								className={`flex h-8 w-8 items-center justify-center rounded-2xl cursor-pointer hover:bg-muted/40 ${uploadDisabled ? "cursor-not-allowed opacity-40" : ""}`}
							>
								<input
									id="file-upload"
									ref={fileInputRef}
									type="file"
									multiple
									accept="image/*"
									onChange={handleLocalFileChange}
									className="hidden"
									disabled={uploadDisabled}
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
						<ModelSelector
							selectedModelId={selectedModel}
							setSelectedModelId={onSelectModel}
							className="rounded-full"
						/>
						{/* Unified Model & Provider Configuration Sheet */}
						<UnifiedConfigSheet
							selectedModelId={selectedModel}
							value={{
								temperature: modelConfig.temperature,
								maxOutputTokens: modelConfig.maxOutputTokens,
								topP: modelConfig.topP,
								topK: modelConfig.topK,
								frequencyPenalty: modelConfig.frequencyPenalty,
								presencePenalty: modelConfig.presencePenalty,
								openai: modelConfig.openai,
								google: modelConfig.google,
								anthropic: modelConfig.anthropic,
							}}
							onChange={(update) => setModelConfig(update)}
							gateway={
								modelsSource === "aigateway"
									? "vercel-ai-gateway"
									: "llm-gateway"
							}
							disabled={!hasRequiredKey}
						/>
						<PromptInputAction
							tooltip={searchAllowed.allowed ? (isSearchEnabled ? "Disable web search" : "Enable web search") : (searchAllowed.reason || "Configure web search")}
						>
							<Button
								variant={isSearchEnabled ? "secondary" : "outline"}
								size="sm"
								className="flex items-center gap-1 rounded-full px-2 py-1"
								onClick={toggleSearch}
								disabled={!searchAllowed.allowed}
							>
								<Globe size={18} />
								<span className="overflow-hidden whitespace-nowrap text-xs">Search</span>
							</Button>
						</PromptInputAction>
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
								: disabled ||
								!hasRequiredKey ||
								isUploading ||
								(isOnlyWhitespace(value) && files.length === 0) ||
								isSubmitting;
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
