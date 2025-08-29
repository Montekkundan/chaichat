"use client";

import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { LinkIcon, LinkSimpleBreakIcon, Paperclip } from "@phosphor-icons/react";
import { useAction } from "convex/react";
import {
	ChevronLeft,
	ChevronRight,
	MoreHorizontal,
	Plus,
	RotateCcw,
	SendIcon,
	Settings,
	Trash2,
	X,
} from "lucide-react";
import { Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModelSelector } from "~/components/chat-input/model-selector";
import { Conversation } from "~/components/chat/conversation";
import { UnifiedConfigDropdown } from "~/components/model-config";
import { filterValidFiles } from "~/lib/file-upload/validation";
import { generateReactHelpers } from "@uploadthing/react";
import type { UploadRouter } from "~/app/api/uploadthing/core";
import { toast } from "~/components/ui/toast";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useLLMModels } from "~/hooks/use-models";
import {
	type ChatColumn,
	usePlayground,
} from "~/lib/providers/playground-provider";
import type { LLMGatewayModel } from "~/types/llmgateway";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useEffect as _useEffect } from "react";
import { cn } from "~/lib/utils";
import { modelSupportsVision, isStorageReady } from "~/lib/model-capabilities";

interface PlaygroundColumnProps {
	column: ChatColumn;
	columnIndex: number;
}

export function PlaygroundColumn({
	column,
	columnIndex,
}: PlaygroundColumnProps) {
	const { user } = useUser();
	const getKeys = useAction(api.userKeys.getKeys);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasLlmKey, setHasLlmKey] = useState<boolean>(false);
	const [hasAiKey, setHasAiKey] = useState<boolean>(false);

	// Drag and drop state
	const [isDragOver, setIsDragOver] = useState(false);
	const [dragCounter, setDragCounter] = useState(0);
	const [files, setFiles] = useState<import("~/components/chat-input/file-items").UploadedFile[]>([]);

	// UploadThing setup
	const uploadHelpers = generateReactHelpers<UploadRouter>();
	const { useUploadThing } = uploadHelpers;
	const { startUpload, isUploading } = useUploadThing("chatFiles");

	// Track files selected/pasted but not yet uploaded
	const pendingFilesRef = useRef<File[]>([]);

	// File input ref for manual file selection
	const fileInputRef = useRef<HTMLInputElement>(null);

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

	// Upload function that handles both storage providers
	const uploadFile = async (file: File): Promise<{ url: string; name: string; size: number; contentType: string } | null> => {
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
		// Upload to UploadThing (existing logic)
		const uploadResult = await startUpload([file]);
		if (uploadResult?.[0]) {
			const uploadedFile = uploadResult[0];
			return {
				url: uploadedFile.url,
				name: uploadedFile.name || file.name,
				size: uploadedFile.size || file.size,
				contentType: file.type,
			};
		}
		throw new Error("Failed to upload to UploadThing");
	};

	// Per-column scroll API so Enter can scroll to bottom if needed
	const conversationScrollApiRef = useRef<{
		scrollToBottom: () => void;
		getIsAtBottom: () => boolean;
	} | null>(null);

	// Per-column gateway source and models (controlled by ModelSelector)
	const [columnSource, setColumnSource] = useState<"aigateway" | "llmgateway">(
		column.gatewaySource || "llmgateway",
	);
	// Keep local state in sync with provider/state updates
	useEffect(() => {
		const next = (column.gatewaySource || "llmgateway") as
			| "aigateway"
			| "llmgateway";
		setColumnSource(next);
	}, [column.gatewaySource]);

	useEffect(() => {
		const loadKeys = async () => {
			try {
				if (user?.id) {
					const result = (await getKeys({})) as {
						llmGatewayApiKey?: string;
						aiGatewayApiKey?: string;
					};
					setHasLlmKey(Boolean(result?.llmGatewayApiKey));
					setHasAiKey(Boolean(result?.aiGatewayApiKey));
				} else {
					const { getAllKeys } = await import("~/lib/local-keys");
					const local = await getAllKeys();
					setHasLlmKey(Boolean(local?.llmGatewayApiKey));
					setHasAiKey(Boolean(local?.aiGatewayApiKey));
				}
			} catch {
				setHasLlmKey(false);
				setHasAiKey(false);
			}
		};
		void loadKeys();
		const onChanged = () => void loadKeys();
		window.addEventListener("apiKeysChanged", onChanged);
		return () => window.removeEventListener("apiKeysChanged", onChanged);
	}, [user?.id, getKeys]);
	const {
		models,
		isLoading: isModelsLoading,
		error: modelsError,
	} = useLLMModels({ source: columnSource, controlled: true });

	// Determine model and storage capabilities
	const supportsAttachments = useMemo(() => {
		// While models load, don't block drag/drop
		if (isModelsLoading) return true;
		try {
			return modelSupportsVision(models, column.modelId || "");
		} catch {
			return true;
		}
	}, [models, column.modelId, isModelsLoading]);

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

	const formatPrice = useCallback((price: string | undefined) => {
		if (!price || price === "undefined" || price === "null") return "Free";
		const num = Number.parseFloat(price);
		if (Number.isNaN(num) || num === 0) return "Free";
		if (num < 0.001) return `$${(num * 1000000).toFixed(2)}/1M`;
		if (num < 1) return `$${(num * 1000).toFixed(2)}/1K`;
		return `$${num.toFixed(2)}`;
	}, []);

	// Resolve the selected model (supports provider-prefixed ids like `provider/model`)
	const { selectedModel, selectedProviderLabel, promptPrice, completionPrice } =
		useMemo(() => {
			const selectedId = column.modelId || "";
			let model: LLMGatewayModel | undefined;
			let providerLabel: string | undefined;
			let prompt: string | undefined;
			let completion: string | undefined;

			if (!selectedId)
				return {
					selectedModel: undefined,
					selectedProviderLabel: undefined,
					promptPrice: undefined,
					completionPrice: undefined,
				};

			if (selectedId.includes("/")) {
				const firstSlash = selectedId.indexOf("/");
				const provider = selectedId.substring(0, firstSlash);
				const modelName = selectedId.substring(firstSlash + 1);
				model = models.find((m) =>
					m.providers?.some(
						(p) =>
							p.providerId === provider &&
							(p.modelName === modelName ||
								p.modelName.endsWith(`/${modelName}`)),
					),
				);
				const providerInfo = model?.providers?.find(
					(p) => p.providerId === provider,
				);
				providerLabel = providerInfo ? providerInfo.providerId : undefined;
				prompt = providerInfo?.pricing?.prompt ?? model?.pricing?.prompt;
				completion =
					providerInfo?.pricing?.completion ?? model?.pricing?.completion;
			} else {
				model = models.find(
					(m) => m.id === selectedId || m.name === selectedId,
				);
				prompt = model?.pricing?.prompt;
				completion = model?.pricing?.completion;
			}

			return {
				selectedModel: model,
				selectedProviderLabel: providerLabel,
				promptPrice: formatPrice(prompt),
				completionPrice: formatPrice(completion),
			};
		}, [column.modelId, models, formatPrice]);

	const {
		columns,
		sharedInput,
		updateColumn,
		removeColumn,
		clearColumn,
		moveColumnLeft,
		moveColumnRight,
		toggleColumnSync,
		updateSharedInput,
		updateColumnInput,
		sendToColumn,
		sendToSyncedColumns,
		addColumn,
		maxColumns,
		registerColumnScrollApi,
		stopColumn,
		stopSyncedColumns,
		sharedAttachments,
		setSharedAttachments,
	} = usePlayground();

	const handleModelChange = (modelId: string) => {
		updateColumn(column.id, { modelId });
	};

	// Persist per-column gateway selection back to provider state
	const handleSourceChange = useCallback(
		(src: "aigateway" | "llmgateway") => {
			setColumnSource(src);
			updateColumn(column.id, { gatewaySource: src });
		},
		[column.id, updateColumn],
	);

	const handleInputChange = (value: string) => {
		if (column.synced) {
			updateSharedInput(value);
		} else {
			updateColumnInput(column.id, value);
		}
	};

	const handleConfigChange = (config: Partial<typeof column.config>) => {
		updateColumn(column.id, { config: { ...column.config, ...config } });
	};

	const handleDragEnter = useCallback((e: React.DragEvent) => {
		const hasKey = columnSource === "aigateway" ? hasAiKey : hasLlmKey;
		if (!storageReady.ready || !hasKey || !supportsAttachments) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter(prev => prev + 1);
		if (e.dataTransfer?.types.includes('Files')) {
			setIsDragOver(true);
		}
	}, [supportsAttachments, storageReady.ready, hasAiKey, hasLlmKey, columnSource]);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		const hasKey = columnSource === "aigateway" ? hasAiKey : hasLlmKey;
		if (!storageReady.ready || !hasKey || !supportsAttachments) return;
		e.preventDefault();
		e.stopPropagation();
		setDragCounter(prev => {
			const newCounter = prev - 1;
			if (newCounter === 0) {
				setIsDragOver(false);
			}
			return newCounter;
		});
	}, [supportsAttachments, storageReady.ready, hasAiKey, hasLlmKey, columnSource]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		const hasKey = columnSource === "aigateway" ? hasAiKey : hasLlmKey;
		if (!storageReady.ready || !hasKey || !supportsAttachments) return;
		e.preventDefault();
		e.stopPropagation();
	}, [supportsAttachments, storageReady.ready, hasAiKey, hasLlmKey, columnSource]);

	const handleDrop = useCallback(async (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragOver(false);
		setDragCounter(0);

		if (!supportsAttachments && !isModelsLoading) {
			toast({ title: "Selected model may not support image inputs", status: "warning" });
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
			} as import("~/components/chat-input/file-items").UploadedFile;
		});
		const nextFiles = [...files, ...previews];
		setFiles(nextFiles);
		// Broadcast to synced columns for preview reuse
		try { setSharedAttachments(nextFiles.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size }))); } catch { }
	}, [user?.id, files, setSharedAttachments]);

	// Mirror shared attachments (previews) into this column when synced
	_useEffect(() => {
		if (!column.synced) return;
		if (!Array.isArray(sharedAttachments)) return;
		// Only update if local files differ and no local pending uploads
		if (pendingFilesRef.current.length === 0) {
			setFiles((prev) => {
				const same = prev.length === sharedAttachments.length && prev.every((p, i) => p.url === sharedAttachments[i]?.url);
				return same ? prev : [...sharedAttachments];
			});
		}
	}, [column.synced, sharedAttachments]);

	const handleLocalFileChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
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
			} as import("~/components/chat-input/file-items").UploadedFile;
		});
		const nextFiles2 = [...files, ...previews];
		setFiles(nextFiles2);
		try { setSharedAttachments(nextFiles2.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size }))); } catch { }
		// reset input so same file can be selected again
		e.target.value = "";
	};

	const handleFileRemove = useCallback((file: import("~/components/chat-input/file-items").UploadedFile) => {
		const next = files.filter(f => f.name !== file.name || f.size !== file.size);
		setFiles(next);
		if (file.local) {
			pendingFilesRef.current = pendingFilesRef.current.filter(
				(f) => f.name !== file.name || f.size !== file.size,
			);
		}
		// Propagate to shared attachments outside of render/update closures
		try {
			if (column.synced) {
				setSharedAttachments(next.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size })));
			}
		} catch { }
	}, [files, column.synced, setSharedAttachments]);

	const handleSend = async () => {
		if (isSubmitting) return;
		const inputValue = column.synced ? sharedInput : column.input;
		const trimmedInput = inputValue.trim();

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
			const match = trimmedInput.match(pattern);
			if (match && typeof match[1] === "string") {
				imagePrompt = match[1].trim();
				break;
			}
		}

		if (imagePrompt) {
			// Handle image generation
			try {
				setIsSubmitting(true);

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
							model: column.modelId.includes("dall-e") ? column.modelId : "openai/dall-e-3",
							n: 1,
						},
						gateway: columnSource === "aigateway" ? "vercel-ai-gateway" : "llm-gateway",
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
						})) as import("~/components/chat-input/file-items").UploadedFile[];

						// Add generated images to the files
						setFiles([...files, ...generatedAttachments]);

						toast({
							title: `Generated ${result.images.length} image(s)`,
							status: "success"
						});

						// Clear the input
						if (column.synced) {
							updateSharedInput("");
						} else {
							updateColumnInput(column.id, "");
						}
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
			} finally {
				setIsSubmitting(false);
			}
			return;
		}

		if (!trimmedInput && files.length === 0) return;

		// Prepare attachment list
		let attachmentsToSend: import("~/components/chat-input/file-items").UploadedFile[] = files;

		// First, upload any pending local files
		if (pendingFilesRef.current.length > 0) {
			try {
				const uploadPromises = pendingFilesRef.current.map(file => uploadFile(file));
				const uploadResults = await Promise.all(uploadPromises);

				const uploaded = uploadResults
					.filter((result): result is NonNullable<typeof result> => result !== null)
					.map(result => ({
						name: result.name,
						url: result.url,
						contentType: result.contentType,
						size: result.size,
					})) as import("~/components/chat-input/file-items").UploadedFile[];

				const newList = files.filter((f) => !f.local).concat(uploaded);
				setFiles(newList);
				try { setSharedAttachments(newList.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size }))); } catch { }
				attachmentsToSend = newList;
			} catch (err) {
				console.error("Upload before send failed", err);
				toast({ title: "Upload failed", status: "error" });
				return; // abort send
			} finally {
				pendingFilesRef.current = [];
			}
		}

		// Optimistically clear the input for snappy UX
		if (column.synced) {
			updateSharedInput("");
		} else {
			updateColumnInput(column.id, "");
		}
		setFiles([]); // Clear files after sending
		try { setSharedAttachments([]); } catch { }

		setIsSubmitting(true);

		// Optimistically mark this column as streaming for immediate UI feedback
		try {
			updateColumn(column.id, { isStreaming: true, status: "submitted" });
		} catch { }

		// Scroll to bottom if not at bottom already
		try {
			if (
				conversationScrollApiRef.current &&
				!conversationScrollApiRef.current.getIsAtBottom()
			) {
				conversationScrollApiRef.current.scrollToBottom();
			}
		} catch { }

		try {
			if (column.synced) {
				// Delegate to provider for synced columns, sharing uploaded attachments
				await sendToSyncedColumns(trimmedInput, attachmentsToSend);
			} else {
				// Handle individual column send with attachments
				await sendToColumn(column.id, trimmedInput);
			}

			// Clear input
			if (column.synced) {
				updateSharedInput("");
			} else {
				updateColumnInput(column.id, "");
			}
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const currentInput = column.synced ? sharedInput : column.input;
	const hasRequiredKey = columnSource === "aigateway" ? hasAiKey : hasLlmKey;
	const uploadDisabled = !hasRequiredKey || !supportsAttachments || !storageReady.ready;

	const canMoveLeft = columnIndex > 0;
	const canMoveRight = columnIndex < columns.length - 1;
	const canRemove = columns.length > 1;

	const derivedStatus: "submitted" | "streaming" | "ready" | "error" =
		column.status && column.status !== "ready"
			? column.status
			: isSubmitting
				? "submitted"
				: column.isStreaming
					? "streaming"
					: "ready";

	return (
		<div
			className={cn(
				"relative flex h-full min-h-0 flex-col rounded-xl border",
				isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			{/* Full-column drag overlay */}
			{isDragOver && (
				<div className="pointer-events-none absolute inset-0 z-20 bg-primary/10 backdrop-blur-sm rounded-xl border-2 border-dashed border-primary flex items-center justify-center">
					<div className="text-center text-primary">
						<div className="font-medium">Drop images anywhere</div>
						<div className="text-sm text-muted-foreground">Supported: JPEG, PNG, WebP, GIF</div>
					</div>
				</div>
			)}
			<div className="h-full min-h-0 w-full rounded-b-md">
				<div
					id={`scroll-container-${column.id}_${columnIndex}`}
					className="flex h-full min-h-0 flex-no-wrap flex-col"
					style={{ overflowAnchor: "none" }}
				>
					{/* Column header */}
					<div className="sticky top-0 z-10 min-h-0 min-w-0 flex-shrink-0">
						<div className="m-1 flex items-center justify-between py-2 pr-2 pl-3 backdrop-blur">
							<div className="min-w-0 flex-1">
								<div className="flex flex-1 flex-col">
									<div className="relative grid gap-2">
										<ModelSelector
											selectedModelId={column.modelId}
											setSelectedModelId={handleModelChange}
											className="ease inline-flex h-[32px] w-full max-w-[288px] items-center justify-between truncate rounded-md border bg-background px-3 py-0.5 font-mono text-foreground leading-6 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
											isUserAuthenticated={!!user?.id}
											source={columnSource}
											onSourceChange={handleSourceChange}
										/>
									</div>
								</div>
							</div>

							<div className="ml-1 flex items-center">
								<div className="flex items-center">
									{/* Sync badge */}
									{column.synced && (
										<div className="mx-2 hidden h-6 items-center rounded-full bg-secondary px-3 text-md text-secondary-foreground text-sm lg:flex">
											Synced
										</div>
									)}

									{/* Unified Model & Provider Configuration */}
									<UnifiedConfigDropdown
										selectedModelId={column.modelId}
										value={{
											temperature: column.config.temperature,
											maxOutputTokens: column.config.maxOutputTokens,
											topP: column.config.topP,
											topK: column.config.topK,
											frequencyPenalty: column.config.frequencyPenalty,
											presencePenalty: column.config.presencePenalty,
											openai: column.config.openai,
											google: column.config.google,
											anthropic: column.config.anthropic,
										}}
										onChange={(u) => handleConfigChange(u)}
										gateway={
											columnSource === "aigateway"
												? "vercel-ai-gateway"
												: "llm-gateway"
										}
									>
										<Button
											aria-label="Model & Provider Settings"
											variant={"ghost"}
											size={"icon"}
										>
											<span className="button_content__eYZtX button_flex___f_3o">
												<span className="pointer-events-none flex rounded-md p-2">
													<Settings className="h-4 w-4" />
												</span>
											</span>
										</Button>
									</UnifiedConfigDropdown>
								</div>

								{/* Add Column button */}
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												variant={"ghost"}
												onClick={addColumn}
												disabled={columns.length >= maxColumns}
												aria-disabled={columns.length >= maxColumns}
											>
												<Plus className="h-4 w-4" />
											</Button>
										</span>
									</TooltipTrigger>
									{columns.length >= maxColumns && (
										<TooltipContent sideOffset={6}>
											Cannot add more columns
										</TooltipContent>
									)}
								</Tooltip>

								<Button
									onClick={() => toggleColumnSync(column.id)}
									variant={"ghost"}
									size={"icon"}
								>
									{column.synced ? (
										<LinkIcon size={16} />
									) : (
										<LinkSimpleBreakIcon size={16} />
									)}
								</Button>
								{/* Menu button for more options */}
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											aria-label="Add Model"
											variant={"ghost"}
											size={"icon"}
										>
											<span className="button_content__eYZtX button_flex___f_3o button_center__bCjE5">
												<span className="pointer-events-none flex rounded-md p-2">
													<MoreHorizontal className="h-4 w-4" />
												</span>
											</span>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<button
											type="button"
											onClick={() => clearColumn(column.id)}
											className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
										>
											<RotateCcw className="mr-2 h-4 w-4" />
											Clear Chat
										</button>
										<Separator className="my-1" />
										<DropdownMenuItem
											onClick={() => moveColumnLeft(column.id)}
											disabled={!canMoveLeft}
										>
											<ChevronLeft className="mr-2 h-4 w-4" />
											Scroll Left
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => moveColumnRight(column.id)}
											disabled={!canMoveRight}
										>
											<ChevronRight className="mr-2 h-4 w-4" />
											Scroll Right
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={() => removeColumn(column.id)}
											disabled={!canRemove}
											className="text-destructive"
										>
											<Trash2 className="mr-2 h-4 w-4" />
											Delete Column
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
					</div>
					<Separator />

					{/* Messages content area */}
					<div className="min-h-0 min-w-0 flex-1">
						<div
							id={`scroll-container-inner-${column.id}_${columnIndex}`}
							className="scrolling-touch scrolling-gpu relative h-full w-full overscroll-y-contain"
						>
							{column.messages.length > 0 ? (
								<Conversation
									messages={column.messages}
									status={derivedStatus}
									gateway={
										columnSource === "aigateway"
											? "vercel-ai-gateway"
											: "llm-gateway"
									}
									scrollButtonBottomClass="bottom-2"
									registerScrollApi={(api) => {
										conversationScrollApiRef.current = api;
										// Register with provider so synced sends can scroll all columns
										try {
											registerColumnScrollApi(column.id, api ?? null);
										} catch { }
									}}
									onDelete={(id) => {
										updateColumn(column.id, {
											messages: column.messages.filter((msg) => msg.id !== id),
										});
									}}
									onEdit={(id, newText) => {
										updateColumn(column.id, {
											messages: column.messages.map((msg) =>
												msg.id === id
													? {
														...msg,
														content: newText,
														parts: [{ type: "text", text: newText }],
													}
													: msg,
											),
										});
									}}
									onReload={() => {
										// Find the last user message and resend
										const lastUserMessage = [...column.messages]
											.reverse()
											.find((msg) => msg.role === "user");
										if (lastUserMessage?.content) {
											// Remove messages after the last user message
											const messagesReversed = [...column.messages].reverse();
											const lastUserIndexFromEnd = messagesReversed.findIndex(
												(msg) => msg.role === "user",
											);
											const lastUserIndex =
												column.messages.length - 1 - lastUserIndexFromEnd;
											const messagesUpToLastUser = column.messages.slice(
												0,
												lastUserIndex + 1,
											);
											updateColumn(column.id, {
												messages: messagesUpToLastUser,
											});

											// Resend the message
											if (column.synced) {
												sendToSyncedColumns(lastUserMessage.content);
											} else {
												sendToColumn(column.id, lastUserMessage.content);
											}
										}
									}}
								/>
							) : (
								// Start page with model info (minimal)
								<div className="flex size-full items-center justify-center px-4">
									<div className="w-full max-w-xl rounded-lg border bg-white shadow-xs dark:bg-black">
										<div className="p-5 text-sm">
											<div className="flex items-center gap-2">
												<div className="space-x-1">
													<span className="font-medium text-zinc-800 dark:text-zinc-200">
														{selectedModel?.name ?? column.modelId}
													</span>
													{selectedProviderLabel && (
														<span className="text-zinc-600 dark:text-zinc-400">
															· {selectedProviderLabel}
														</span>
													)}
												</div>
											</div>

											{isModelsLoading ? (
												<div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
													Loading model details…
												</div>
											) : modelsError ? (
												<div className="mt-3 text-red-500 text-xs">
													{modelsError}
												</div>
											) : (
												<>
													<div className="mt-2 text-xs text-zinc-600 leading-relaxed dark:text-zinc-400">
														{selectedModel?.description ||
															"Start a conversation to test this model."}
													</div>
													<div className="mt-3 flex flex-wrap gap-2 text-[11px]">
														<span className="rounded border px-2 py-1">
															Context: {selectedModel?.context_length ?? "-"}{" "}
															tokens
														</span>
														<span className="rounded border px-2 py-1">
															Input: {promptPrice}
														</span>
														<span className="rounded border px-2 py-1">
															Output: {completionPrice}
														</span>
													</div>
												</>
											)}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Sticky bottom input */}
					<div
						className={cn(
							"sticky bottom-0 min-h-0 min-w-0 flex-shrink-0 relative",
						)}
					>
						<div className="flex items-center gap-2 border-t bg-background-200 p-3 pr-2.5">
							<form
								className="relative flex w-full flex-col items-center"
								onSubmit={(e) => {
									e.preventDefault();
									handleSend();
								}}
							>
								{/* File display */}
								{files.length > 0 && (
									<div className="mb-2 flex w-full flex-wrap gap-2">
										{files.map((file, index) => (
											<div key={`${file.name}-${file.size}-${index}`} className="relative mr-2 mb-0 flex items-center">
												<div className="flex w-full items-center gap-3 rounded-2xl border border-input bg-background p-2 pr-3 transition-colors hover:bg-accent">
													<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent-foreground">
														{file.contentType.includes("image") ? (
															<img
																src={file.url}
																alt={file.name}
																className="h-full w-full object-cover"
															/>
														) : (
															<div className="text-center text-gray-400 text-xs">
																{file.name.split(".").pop()?.toUpperCase()}
															</div>
														)}
													</div>
													<div className="flex flex-col overflow-hidden">
														<span className="truncate font-medium text-xs">{file.name}</span>
														<span className="text-gray-500 text-xs">
															{(file.size / 1024).toFixed(2)}kB
														</span>
													</div>
												</div>
												<button
													type="button"
													onClick={() => handleFileRemove(file)}
													className="-translate-y-1/2 absolute top-1 right-1 z-10 inline-flex size-6 translate-x-1/2 items-center justify-center rounded-full border-[3px] border-background bg-black text-white shadow-none transition-colors"
													aria-label="Remove file"
												>
													<X className="size-3" />
												</button>
											</div>
										))}
									</div>
								)}
								{/* File upload button */}
								{files.length === 0 && (
									<Tooltip>
										<TooltipTrigger asChild>
											<label
												htmlFor={`file-upload-${column.id}`}
												className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-6 w-6 items-center justify-center rounded cursor-pointer hover:bg-muted/40 ${uploadDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
												aria-disabled={uploadDisabled}
											>
												<input
													id={`file-upload-${column.id}`}
													ref={fileInputRef}
													type="file"
													multiple
													accept="image/*"
													onChange={handleLocalFileChange}
													className="hidden"
													disabled={uploadDisabled}
												/>
												<Paperclip className="size-4 text-muted-foreground hover:text-primary" />
											</label>
										</TooltipTrigger>
										{uploadDisabled ? (
											<TooltipContent side="top">
												<div className="text-xs">
													{!supportsAttachments
														? 'Selected model does not support image inputs'
														: (!storageReady.ready
															? (storageReady.reason || 'Storage not configured')
															: (!hasRequiredKey
																? `Please add your ${columnSource === 'aigateway' ? 'Vercel AI Gateway' : 'LLM Gateway'} API key`
																: ''))}
												</div>
											</TooltipContent>
										) : (
											<TooltipContent side="top">Attach images</TooltipContent>
										)}
									</Tooltip>
								)}
								<textarea
									placeholder={
										hasRequiredKey
											? column.synced
												? "Type a synced message..."
												: "Type your message…"
											: `Please add your ${columnSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key to start chatting`
									}
									value={currentInput}
									onChange={(e) => {
										handleInputChange(e.target.value);
										const target = e.target as HTMLTextAreaElement;
										target.style.height = "auto";
										target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
									}}
									className={`max-h-[120px] min-h-[38px] w-full resize-none overflow-y-auto rounded-md border bg-background-100 py-2 pr-9 ${files.length === 0 ? 'pl-10' : 'pl-4'} text-sm focus:border-zinc-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-zinc-600`}
									spellCheck="false"
									rows={1}
									style={{
										fontFamily: "var(--font-geist-sans)",
										height: "38px",
										lineHeight: "1.5",
									}}
									disabled={!hasRequiredKey}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											if (!hasRequiredKey) return;
											handleSend();
										}
									}}
								/>
								{/* Right icon overlay inside input */}
								{column.isStreaming || derivedStatus === "streaming" ? (
									<button
										type="button"
										aria-label="Stop"
										onClick={() =>
											column.synced ? stopSyncedColumns() : stopColumn(column.id)
										}
										className="absolute right-2 bottom-2 inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-primary"
									>
										<Square className="h-4 w-4" />
									</button>
								) : (
									<button
										type="button"
										aria-label="Send Message"
										onClick={handleSend}
										disabled={!hasRequiredKey || isSubmitting || !currentInput.trim()}
										className="absolute right-2 bottom-2 inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
									>
										<SendIcon className="h-4 w-4" />
									</button>
								)}
							</form>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
