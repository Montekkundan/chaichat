"use client";

import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { generateReactHelpers } from "@uploadthing/react";
import { useAction } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEffect as _useEffect } from "react";
import { Conversation } from "~/components/chat/conversation";
import { filterValidFiles } from "~/lib/file-upload/validation";
import type { UploadRouter } from "~/app/api/uploadthing/core";
import { toast } from "~/components/ui/toast";
import { useLLMModels } from "~/hooks/use-models";
import {
	type ChatColumn,
	usePlayground,
} from "~/lib/providers/playground-provider";
import { modelSupportsVision, isStorageReady } from "~/lib/model-capabilities";
import { cn } from "~/lib/utils";
import type { LLMGatewayModel } from "~/types/llmgateway";
import { Separator } from "../ui/separator";
import { ColumnContainer } from "./components/column-container";
import { ColumnEmptyState } from "./components/column-empty-state";
import { ColumnHeader } from "./components/column-header";
import { ColumnInput } from "./components/column-input";
import { ColumnSystemContext } from "./components/column-system-context";

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
	const [, setDragCounter] = useState(0);
	const [files, setFiles] = useState<import("~/components/chat-input/file-items").UploadedFile[]>([]);

	// UploadThing setup
	const uploadHelpers = generateReactHelpers<UploadRouter>();
	const { useUploadThing } = uploadHelpers;
	const { startUpload } = useUploadThing("chatFiles");

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

	// Web search toggle state synced with localStorage
	const [searchEnabled, setSearchEnabled] = useState<boolean>(false);
	const [isHydrated, setIsHydrated] = useState(false);
	useEffect(() => {
		setIsHydrated(true);
		try {
			setSearchEnabled(localStorage.getItem("chaichat_search_enabled") === "true");
		} catch { }
		const onStorage = () => {
			try {
				setSearchEnabled(localStorage.getItem("chaichat_search_enabled") === "true");
			} catch { }
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const computeSearchDisabled = useCallback(() => {
		try {
			const sp = localStorage.getItem("chai-search-provider");
			const hasExa = !!localStorage.getItem("chaichat_keys_exa");
			const hasFire = !!localStorage.getItem("chaichat_keys_firecrawl");
			if (sp === "exa") return !hasExa;
			if (sp === "firecrawl") return !hasFire;
			return true;
		} catch {
			return true;
		}
	}, []);

	const searchDisabled = isHydrated ? computeSearchDisabled() : undefined;

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
		// TODO: Allow attachments for AI Gateway regardless of model metadata until modalities are exposed
		if (columnSource === "aigateway") return true;
		// While models load, don't block drag/drop
		if (isModelsLoading) return true;
		try {
			return modelSupportsVision(models, column.modelId || "");
		} catch {
			return true;
		}
	}, [models, column.modelId, isModelsLoading, columnSource]);

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
		toggleColumnMergeContext,
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
		try {
			if (column.synced) {
				setSharedAttachments(nextFiles.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size })));
			}
		} catch { }
	}, [files, setSharedAttachments, isModelsLoading, supportsAttachments, column.synced]);

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

	// When this column becomes synced, broadcast its current local previews so
	// other synced columns can mirror them.
	useEffect(() => {
		if (!column.synced) return;
		if (files.length === 0) return;
		try {
			setSharedAttachments(files.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size })));
		} catch { }
		// We intentionally depend on `column.synced` to run once on toggle-on
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [column.synced, files, setSharedAttachments]);

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
		try {
			if (column.synced) {
				setSharedAttachments(nextFiles2.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size })));
			}
		} catch { }
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
				try {
					if (column.synced) {
						setSharedAttachments(newList.map(f => ({ name: f.name, url: f.url, contentType: f.contentType, size: f.size })));
					}
				} catch { }
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
		try {
			if (column.synced) setSharedAttachments([]);
		} catch { }

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
				await sendToColumn(column.id, trimmedInput, attachmentsToSend);
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

	const handleStop = useCallback(() => {
		if (column.synced) {
			stopSyncedColumns();
		} else {
			stopColumn(column.id);
		}
	}, [column.id, column.synced, stopColumn, stopSyncedColumns]);

	const handleToggleSearch = useCallback(() => {
		setSearchEnabled((prev) => {
			const next = !prev;
			try {
				localStorage.setItem("chaichat_search_enabled", next ? "true" : "false");
			} catch {}
			return next;
		});
	}, []);

	const uploadDisabledReason = uploadDisabled
		? !supportsAttachments
			? "Selected model does not support image inputs"
			: !storageReady.ready
				? storageReady.reason || "Storage not configured"
				: !hasRequiredKey
					? `Please add your ${columnSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key`
					: "Uploads unavailable"
		: undefined;

	const dragOverlay = (
		<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
			<div className="text-center text-primary">
				<div className="font-medium">Drop images anywhere</div>
				<div className="text-sm text-muted-foreground">Supported: JPEG, PNG, WebP, GIF</div>
			</div>
		</div>
	);

	return (
		<ColumnContainer
			isDragOver={isDragOver}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			dragOverlay={dragOverlay}
		>
			<div
				id={`scroll-container-${column.id}_${columnIndex}`}
				className="flex h-full min-h-0 flex-no-wrap flex-col"
				style={{ overflowAnchor: "none" }}
			>
				<div className="sticky top-0 z-10 min-h-0 min-w-0 flex-shrink-0">
					<ColumnHeader
						column={column}
						columnSource={columnSource}
						onModelChange={handleModelChange}
						onSourceChange={handleSourceChange}
						onConfigChange={handleConfigChange}
						onAddColumn={addColumn}
						columnsLength={columns.length}
						maxColumns={maxColumns}
						onToggleSync={toggleColumnSync}
						onToggleMergeContext={toggleColumnMergeContext}
						onClearColumn={clearColumn}
						onMoveLeft={moveColumnLeft}
						onMoveRight={moveColumnRight}
						onRemoveColumn={removeColumn}
						canMoveLeft={canMoveLeft}
						canMoveRight={canMoveRight}
						canRemove={canRemove}
						isUserAuthenticated={!!user?.id}
					/>
				</div>
				<Separator />
				<ColumnSystemContext
					columnId={column.id}
					value={column.systemPrompt ?? ""}
					onChange={(value) => updateColumn(column.id, { systemPrompt: value })}
				/>
				<Separator />
				<div className="min-h-0 min-w-0 flex-1">
					<div
						id={`scroll-container-inner-${column.id}_${columnIndex}`}
						className="scrolling-gpu scrolling-touch relative h-full w-full overscroll-y-contain"
					>
						{column.messages.length > 0 ? (
							<Conversation
								messages={column.messages}
								status={derivedStatus}
								gateway={columnSource === "aigateway" ? "vercel-ai-gateway" : "llm-gateway"}
								scrollButtonBottomClass="bottom-2"
								registerScrollApi={(api) => {
									conversationScrollApiRef.current = api;
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
									const lastUserMessage = [...column.messages]
										.reverse()
										.find((msg) => msg.role === "user");
									if (lastUserMessage?.content) {
										const messagesReversed = [...column.messages].reverse();
										const lastUserIndexFromEnd = messagesReversed.findIndex((msg) => msg.role === "user");
										const lastUserIndex = column.messages.length - 1 - lastUserIndexFromEnd;
										const messagesUpToLastUser = column.messages.slice(0, lastUserIndex + 1);
										updateColumn(column.id, { messages: messagesUpToLastUser });

										if (column.synced) {
											sendToSyncedColumns(lastUserMessage.content);
										} else {
											sendToColumn(column.id, lastUserMessage.content);
										}
									}
								}}
							/>
						) : (
							<ColumnEmptyState
								modelId={column.modelId}
								selectedModel={selectedModel}
								selectedProviderLabel={selectedProviderLabel}
								isModelsLoading={isModelsLoading}
								modelsError={modelsError}
								promptPrice={promptPrice}
								completionPrice={completionPrice}
							/>
						)}
					</div>
				</div>
				<div className={cn("sticky bottom-0 min-h-0 min-w-0 flex-shrink-0", "relative")}>
					<ColumnInput
						columnId={column.id}
						columnSource={columnSource}
						columnSynced={column.synced}
						columnIsStreaming={column.isStreaming}
						derivedStatus={derivedStatus}
						files={files}
						onFileRemove={handleFileRemove}
						onFileInputChange={handleLocalFileChange}
						fileInputRef={fileInputRef}
						uploadDisabled={uploadDisabled}
						uploadDisabledReason={uploadDisabledReason}
						onSend={handleSend}
						onStop={handleStop}
						onInputChange={handleInputChange}
						currentInput={currentInput}
						hasRequiredKey={hasRequiredKey}
						isSubmitting={isSubmitting}
						onToggleSearch={handleToggleSearch}
						searchEnabled={searchEnabled}
						searchDisabled={searchDisabled}
						isHydrated={isHydrated}
					/>
				</div>
			</div>
		</ColumnContainer>
	);
}
