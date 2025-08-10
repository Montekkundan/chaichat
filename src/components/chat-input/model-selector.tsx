"use client";

import {
	CaretDown,
	CheckCircle,
	Info,
	MagnifyingGlass,
	SlidersHorizontal,
	XCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "~/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { useLLMModels } from "~/hooks/use-models";
import {
	type SelectedModelData,
	getSelectedModel,
	removeSelectedModel,
	setSelectedModel,
} from "~/lib/local-model-storage";
import { cn } from "~/lib/utils";

type ModelSelectorProps = {
	selectedModelId: string;
	setSelectedModelId: (modelId: string) => void;
	className?: string;
	isUserAuthenticated?: boolean;
};

import type { LLMGatewayModel } from "~/types/llmgateway";

type ModelStatusFilter = "any" | "active" | "deprecated" | "deactivated";

export function ModelSelector({
	selectedModelId,
	setSelectedModelId,
	className,
	isUserAuthenticated: _isUserAuthenticated,
}: ModelSelectorProps) {
	const { models, isLoading, error } = useLLMModels();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
	const [filters, setFilters] = useState({
		streaming: false,
		vision: false,
		tools: false,
		jsonOutput: false,
		moderatedMode: "any" as "any" | "moderated" | "unmoderated",
		status: "any" as ModelStatusFilter,
		providerQuery: "",
		minContext: "" as string | number,
		maxPromptPrice: "" as string | number, // in $ per 1K tokens
	});
	const isMobile = useBreakpoint(768);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const hasLoadedFromStorage = useRef(false);
	const pendingSavedModel = useRef<SelectedModelData | null>(null);

	useEffect(() => {
    // Focus search input when the dropdown opens on desktop
    if (!isMobile && isDropdownOpen) {
      const id = window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [isDropdownOpen, isMobile]);

  useEffect(() => {
    // Focus search input when the drawer opens on mobile
    if (isMobile && isDrawerOpen) {
      const id = window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select?.();
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [isDrawerOpen, isMobile]);

  useEffect(() => {
		if (!selectedModelId && !hasLoadedFromStorage.current) {
			const savedModel = getSelectedModel();
			if (savedModel?.modelId) {
				pendingSavedModel.current = savedModel;
				setSelectedModelId(savedModel.modelId);
				hasLoadedFromStorage.current = true;
			}
		}
	}, [selectedModelId, setSelectedModelId]);

	useEffect(() => {
		if (pendingSavedModel.current && models.length > 0) {
			const savedModel = pendingSavedModel.current;
			const modelExists = models.some((model: LLMGatewayModel) => {
				if (
					model.id === savedModel.modelId ||
					model.name === savedModel.modelId
				) {
					return true;
				}
				if (savedModel.modelId.includes("/") && savedModel.providerId) {
					return model.providers?.some(
						(p) =>
							p.providerId === savedModel.providerId &&
							(p.modelName === savedModel.modelId.split("/")[1] ||
								p.modelName === savedModel.modelId),
					);
				}
				return false;
			});
			if (!modelExists) {
				removeSelectedModel();
				if (models.length > 0 && models[0]) {
					setSelectedModelId(models[0].id);
					setSelectedModel(models[0].id);
				}
			}
			pendingSavedModel.current = null;
		}
	}, [models, setSelectedModelId]);

	useEffect(() => {
		if (selectedModelId && hasLoadedFromStorage.current) {
			setSelectedModel(selectedModelId);
		}
	}, [selectedModelId]);

	useEffect(() => {
		if (
			!selectedModelId &&
			!hasLoadedFromStorage.current &&
			models.length > 0
		) {
			const savedModel = getSelectedModel();
			if (!savedModel?.modelId && models[0]) {
				setSelectedModelId(models[0].id);
			}
		}
	}, [models, selectedModelId, setSelectedModelId]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.key === "p" || e.key === "P") && e.metaKey && e.shiftKey) {
				e.preventDefault();
				if (isMobile) {
					setIsDrawerOpen((prev) => !prev);
				} else {
					setIsDropdownOpen((prev) => !prev);
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isMobile]);

	const canonicalSelectedKey = useMemo(() => {
		if (!selectedModelId) return null as string | null;
		const makeKey = (m: LLMGatewayModel) => `${m.id}::${m.name}`;
		if (selectedModelId.includes("/")) {
			const firstSlashIndex = selectedModelId.indexOf("/");
			const provider = selectedModelId.substring(0, firstSlashIndex);
			const modelName = selectedModelId.substring(firstSlashIndex + 1);
			const match = models.find((m) =>
				m.providers?.some(
					(p) => p.providerId === provider && p.modelName === modelName,
				),
			);
			if (match) return makeKey(match);
			const fallback = models.find(
				(m) => m.id === modelName || m.name === modelName,
			);
			return fallback ? makeKey(fallback) : null;
		}
		const byName = models.find((m) => m.name === selectedModelId);
		if (byName) return makeKey(byName);
		const byId = models.find((m) => m.id === selectedModelId);
		return byId ? makeKey(byId) : null;
	}, [selectedModelId, models]);

	const isModelSelected = useCallback(
		(model: LLMGatewayModel) => {
			return canonicalSelectedKey === `${model.id}::${model.name}`;
		},
		[canonicalSelectedKey],
	);
	const isProviderSelected = useCallback(
		(model: LLMGatewayModel, providerId: string) => {
			if (!selectedModelId.includes("/")) return false;
			const firstSlashIndex = selectedModelId.indexOf("/");
			const selectedProvider = selectedModelId.substring(0, firstSlashIndex);
			const selectedModelName = selectedModelId.substring(firstSlashIndex + 1);
			if (selectedProvider !== providerId) return false;
			// Only show the provider selected state for the canonical selected model
			if (canonicalSelectedKey !== `${model.id}::${model.name}`) return false;
			const provider = model.providers?.find((p) => p.providerId === providerId);
			return provider?.modelName === selectedModelName;
		},
		[selectedModelId, canonicalSelectedKey],
	);

	const toggleModelExpanded = useCallback((modelId: string) => {
		setExpandedModels((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(modelId)) {
				newSet.delete(modelId);
			} else {
				newSet.add(modelId);
			}
			return newSet;
		});
	}, []);

	const handleModelSelect = useCallback(
		(model: LLMGatewayModel, providerId?: string) => {
			const providerToUse = providerId || model.providers?.[0]?.providerId;
			const selectedProvider = model.providers?.find(
				(p) => p.providerId === providerToUse,
			);
			const modelName = selectedProvider?.modelName || model.name;
			const modelString = providerToUse
				? `${providerToUse}/${modelName}`
				: model.id;
			setSelectedModelId(modelString);
			setSelectedModel(modelString);
			if (isMobile) {
				setIsDrawerOpen(false);
			} else {
				setIsDropdownOpen(false);
			}
		},
		[isMobile, setSelectedModelId],
	);

	const filteredModels = useMemo(
		() =>
			models
				.filter((model) => {
					const query = searchQuery.toLowerCase();
					const textMatch =
						model.name.toLowerCase().includes(query) ||
						(model.family?.toLowerCase().includes(query) ?? false) ||
						(model.description?.toLowerCase().includes(query) ?? false) ||
						model.id.toLowerCase().includes(query) ||
						(model.providers?.some((p) =>
							p.providerId.toLowerCase().includes(query),
						) ??
							false) ||
						(model.supported_parameters?.some((p) =>
							p.toLowerCase().includes(query),
						) ??
							false);

					// Status filter
					if (filters.status !== "any") {
						const isActive = !model.deactivated_at && !model.deprecated_at;
						if (filters.status === "active" && !isActive) return false;
						if (filters.status === "deprecated" && !model.deprecated_at)
							return false;
						if (filters.status === "deactivated" && !model.deactivated_at)
							return false;
					}

					// Feature toggles (check any provider supports it)
					const providers = model.providers ?? [];
					if (filters.streaming && !providers.some((p) => p.streaming))
						return false;
					if (filters.vision && !providers.some((p) => p.vision)) return false;
					if (filters.tools && !providers.some((p) => p.tools)) return false;
					if (filters.jsonOutput && !model.json_output) return false;
					if (
						filters.moderatedMode === "moderated" &&
						!model.top_provider?.is_moderated
					)
						return false;
					if (
						filters.moderatedMode === "unmoderated" &&
						model.top_provider?.is_moderated
					)
						return false;

					// Provider substring filter
					if (filters.providerQuery) {
						const pq = String(filters.providerQuery).toLowerCase();
						if (!providers.some((p) => p.providerId.toLowerCase().includes(pq)))
							return false;
					}

					// Context length minimum
					if (filters.minContext !== "" && filters.minContext !== null) {
						const minCtx = Number(filters.minContext);
						if (!Number.isNaN(minCtx) && (model.context_length ?? 0) < minCtx)
							return false;
					}

					// Max prompt price (per 1K tokens) across any provider
					if (
						filters.maxPromptPrice !== "" &&
						filters.maxPromptPrice !== null
					) {
						const maxPrice = Number(filters.maxPromptPrice);
						if (!Number.isNaN(maxPrice)) {
							const providerPrices = providers
								.map((p) =>
									p.pricing?.prompt ? Number.parseFloat(p.pricing.prompt) : 0,
								)
								.filter((v) => !Number.isNaN(v));
							const fallbackModelPrompt = model.pricing?.prompt
								? Number.parseFloat(model.pricing.prompt)
								: 0;
							const minProviderPrice =
								providerPrices.length > 0
									? Math.min(...providerPrices)
									: fallbackModelPrompt;
							if (
								!Number.isNaN(minProviderPrice) &&
								minProviderPrice > maxPrice
							)
								return false;
						}
					}

					return textMatch;
				})
				.sort((a, b) => {
					const aActive = !a.deactivated_at && !a.deprecated_at;
					const bActive = !b.deactivated_at && !b.deprecated_at;
					if (aActive && !bActive) return -1;
					if (!aActive && bActive) return 1;

					const aProviders = a.providers?.length || 0;
					const bProviders = b.providers?.length || 0;
					if (aProviders !== bProviders) return bProviders - aProviders;

					return (b.context_length || 0) - (a.context_length || 0);
				}),
		[models, searchQuery, filters],
	);

	const formatPrice = useCallback((price: string | undefined) => {
		if (!price || price === "undefined" || price === "null") return "Free";
		const num = Number.parseFloat(price);
		if (Number.isNaN(num) || num === 0) return "Free";
		if (num < 0.001) return `$${(num * 1000000).toFixed(2)}/1M`;
		if (num < 1) return `$${(num * 1000).toFixed(2)}/1K`;
		return `$${num.toFixed(2)}`;
	}, []);

	const getStatusText = useCallback((model: LLMGatewayModel) => {
		if (!model) return "Unknown";
		if (model.deactivated_at) return "Deactivated";
		if (model.deprecated_at) return "Deprecated";
		return "Active";
	}, []);

	const getDisplayText = useCallback(() => {
		if (!selectedModelId) return "Select model";

		if (selectedModelId.includes("/")) {
			const firstSlashIndex = selectedModelId.indexOf("/");
			const provider = selectedModelId.substring(0, firstSlashIndex);
			const modelName = selectedModelId.substring(firstSlashIndex + 1);

			const matchingModel = models.find((model) =>
				model.providers?.some(
					(p) => p.providerId === provider && p.modelName === modelName,
				),
			);

			if (matchingModel) {
				return matchingModel.name;
			}

			const modelPart = modelName?.split("/").pop();
			return modelPart || selectedModelId;
		}

		const model = models.find(
			(m) => m.id === selectedModelId || m.name === selectedModelId,
		);
		return model ? model.name : selectedModelId;
	}, [selectedModelId, models]);

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			e.stopPropagation();
			setSearchQuery(e.target.value);
		},
		[],
	);

	const renderModelTooltip = useCallback(
		(model: LLMGatewayModel) => (
			<div className="w-80 space-y-0 bg-popover text-popover-foreground">
				<div className="p-4 pb-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 flex-1">
							<div className="font-semibold text-foreground text-sm">
								{model.name}
							</div>
							<div className="mt-1 text-muted-foreground text-xs leading-relaxed">
								{model.description || "No description available"}
							</div>
						</div>
						<span
							className={cn(
								"flex-shrink-0 rounded-full px-2 py-1 font-medium text-xs",
								model.deactivated_at
									? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
									: model.deprecated_at
										? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
										: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
							)}
						>
							{getStatusText(model)}
						</span>
					</div>
				</div>

				<Separator />

				<div className="p-4 py-3">
					<div className="grid grid-cols-2 gap-4 text-xs">
						<div>
							<div className="mb-2 font-medium text-foreground">
								Architecture
							</div>
							<div className="space-y-1.5 text-muted-foreground">
								<div>
									<span className="font-medium">Input:</span>{" "}
									{model.architecture?.input_modalities?.join(", ") || "text"}
								</div>
								<div>
									<span className="font-medium">Output:</span>{" "}
									{model.architecture?.output_modalities?.join(", ") || "text"}
								</div>
								<div>
									<span className="font-medium">Tokenizer:</span>{" "}
									{model.architecture?.tokenizer || "GPT"}
								</div>
							</div>
						</div>

						<div>
							<div className="mb-2 font-medium text-foreground">Features</div>
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 text-muted-foreground">
									{model.providers?.[0]?.streaming ? (
										<CheckCircle className="size-3 flex-shrink-0 text-green-500" />
									) : (
										<XCircle className="size-3 flex-shrink-0 text-red-500" />
									)}
									<span>Streaming</span>
								</div>
								<div className="flex items-center gap-2 text-muted-foreground">
									{model.providers?.[0]?.vision ? (
										<CheckCircle className="size-3 flex-shrink-0 text-green-500" />
									) : (
										<XCircle className="size-3 flex-shrink-0 text-red-500" />
									)}
									<span>Vision</span>
								</div>
								<div className="flex items-center gap-2 text-muted-foreground">
									{model.providers?.[0]?.tools ? (
										<CheckCircle className="size-3 flex-shrink-0 text-green-500" />
									) : (
										<XCircle className="size-3 flex-shrink-0 text-red-500" />
									)}
									<span>Function Calling</span>
								</div>
								<div className="flex items-center gap-2 text-muted-foreground">
									{model.json_output ? (
										<CheckCircle className="size-3 flex-shrink-0 text-green-500" />
									) : (
										<XCircle className="size-3 flex-shrink-0 text-red-500" />
									)}
									<span>JSON Output</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{model.providers && model.providers.length > 0 && (
					<>
						<Separator />
						<div className="p-4 py-3">
							<div className="mb-3 font-medium text-foreground text-xs">
								Available Providers ({model.providers.length})
							</div>
							<div className="space-y-2">
								{model.providers.slice(0, 3).map((provider) => (
									<button
										key={`${provider.providerId}-${provider.modelName}`}
										type="button"
										className={cn(
											"cursor-pointer rounded-md bg-muted/50 px-3 py-2 text-xs transition-colors hover:bg-muted",
											isProviderSelected(model, provider.providerId) &&
												"bg-primary/10 ring-2 ring-primary",
										)}
										onClick={(e) => {
											e.stopPropagation();
											handleModelSelect(model, provider.providerId);
										}}
									>
										<div className="font-medium text-foreground">
											{provider.providerId}
										</div>
										<div className="mt-0.5 text-muted-foreground">
											{formatPrice(provider.pricing?.prompt || "0")}/1K tokens
										</div>
									</button>
								))}
								{model.providers.length > 3 && (
									<div className="pl-3 text-muted-foreground text-xs">
										+{model.providers.length - 3} more providers (click model to
										see all)
									</div>
								)}
							</div>
						</div>
					</>
				)}

				{model.supported_parameters &&
					model.supported_parameters.length > 0 && (
						<>
							<Separator />
							<div className="p-4 py-3">
								<div className="mb-3 font-medium text-foreground text-xs">
									Supported Parameters
								</div>
								<div className="flex flex-wrap gap-1.5">
									{model.supported_parameters.slice(0, 8).map((param) => (
										<Badge
											key={param}
											variant="outline"
											className="h-5 px-2 text-xs"
										>
											{param}
										</Badge>
									))}
									{model.supported_parameters.length > 8 && (
										<Badge variant="outline" className="h-5 px-2 text-xs">
											+{model.supported_parameters.length - 8}
										</Badge>
									)}
								</div>
							</div>
						</>
					)}

				{(model.deprecated_at || model.deactivated_at) && (
					<>
						<Separator />
						<div className="p-4 py-3">
							<div
								className={cn(
									"flex items-center gap-2 rounded-md p-2 text-xs",
									model.deactivated_at
										? "border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
										: "border border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
								)}
							>
								<Info className="size-3 flex-shrink-0" />
								<span>
									{model.deactivated_at
										? "This model has been deactivated and is no longer available."
										: "This model is deprecated and may be removed in the future."}
								</span>
							</div>
						</div>
					</>
				)}
			</div>
		),
		[getStatusText, isProviderSelected, handleModelSelect, formatPrice],
	);

	const duplicateModelIdsRef = useRef<Set<string>>(new Set());

	// Track duplicate ids so UI does not mark all with the same id as selected
	useEffect(() => {
		const counts = new Map<string, number>();
		for (const m of models) {
			counts.set(m.id, (counts.get(m.id) || 0) + 1);
		}
		duplicateModelIdsRef.current = new Set(
			Array.from(counts.entries())
				.filter(([, c]) => c > 1)
				.map(([id]) => id),
		);
	}, [models]);

	const renderModelItem = useCallback(
		(model: LLMGatewayModel) => (
			<TooltipProvider key={`${model.id}::${model.name}`}>
				<Tooltip delayDuration={300}>
					<TooltipTrigger asChild>
						<div className="w-full">
							<div className="flex w-full items-center justify-between gap-2">
								<button
									type="button"
									className={cn(
										"flex w-full flex-1 cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-accent",
										isModelSelected(model) &&
											"border border-primary/30 bg-accent",
										model.deactivated_at && "opacity-60",
									)}
									onClick={() => handleModelSelect(model)}
								>
									<div className="flex min-w-0 flex-1 items-center gap-2">
										<div className="truncate font-medium text-sm">
											{model.name}
										</div>
										{isModelSelected(model) && (
											<div className="size-2 flex-shrink-0 rounded-full bg-primary" />
										)}
									</div>
									<div className="text-muted-foreground text-xs">
										{formatPrice(model.pricing?.prompt || "0")}/1K
									</div>
								</button>

								{model.providers && model.providers.length > 1 && (
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0 hover:bg-accent/50"
										onClick={(e) => {
											e.stopPropagation();
											toggleModelExpanded(model.id);
										}}
									>
										<CaretDown
											className={cn(
												"size-3 transition-transform",
												expandedModels.has(model.id) && "rotate-180",
											)}
										/>
									</Button>
								)}
							</div>

							{expandedModels.has(model.id) &&
								model.providers &&
								model.providers.length > 1 && (
									<div className="ml-4 space-y-1 border-border border-l pl-3">
										{model.providers.map((provider) => (
											<button
												key={`${provider.providerId}-${provider.modelName}`}
												type="button"
												className={cn(
													"flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs transition-colors hover:bg-accent/50",
													isProviderSelected(model, provider.providerId) &&
														"bg-accent/70 ring-1 ring-primary/50",
												)}
												onClick={(e) => {
													e.stopPropagation();
													handleModelSelect(model, provider.providerId);
												}}
											>
												<span className="font-medium">
													{provider.providerId}
												</span>
												<span className="text-muted-foreground">
													{formatPrice(provider.pricing?.prompt || "0")}/1K
												</span>
											</button>
										))}
									</div>
								)}
						</div>
					</TooltipTrigger>
					<TooltipContent
						side="right"
						className="border border-border bg-popover p-0"
					>
						{renderModelTooltip(model)}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		),
		[
			isModelSelected,
			handleModelSelect,
			formatPrice,
			expandedModels,
			toggleModelExpanded,
			isProviderSelected,
			renderModelTooltip,
		],
	);

	const trigger = useMemo(
		() => (
			<Button variant="outline" className={cn("justify-between", className)}>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<div className="truncate font-medium text-sm">{getDisplayText()}</div>
				</div>
				<CaretDown className="ml-2 size-4 flex-shrink-0 opacity-50" />
			</Button>
		),
		[className, getDisplayText],
	);

	if (isLoading) {
		return (
			<Button
				variant="outline"
				className={cn("justify-between", className)}
				disabled
			>
				<span>Loading models...</span>
				<CaretDown className="size-4 opacity-50" />
			</Button>
		);
	}

	if (error) {
		return (
			<Button
				variant="outline"
				className={cn("justify-between", className)}
				disabled
			>
				<span className="text-red-500">Error loading models</span>
				<CaretDown className="size-4 opacity-50" />
			</Button>
		);
	}

	if (isMobile) {
		return (
			<TooltipProvider>
				<Drawer
					open={isDrawerOpen}
					onOpenChange={(open) => {
						setIsDrawerOpen(open);
						if (!open) {
							setExpandedModels(new Set());
						}
					}}
				>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>Select Model</DrawerTitle>
						</DrawerHeader>
						<div className="px-4 pb-2">
							<div className="relative">
								<MagnifyingGlass className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									ref={searchInputRef}
									placeholder={`Search ${filteredModels.length} models...`}
									className="pr-10 pl-8"
                  autoFocus
									value={searchQuery}
									onChange={handleSearchChange}
									onClick={(e) => e.stopPropagation()}
								/>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											type="button"
											aria-label="Open filters"
											className="absolute top-1.5 right-1.5 h-7 w-7 p-0 hover:bg-accent/50"
										>
											<SlidersHorizontal className="h-4 w-4" />
										</Button>
									</PopoverTrigger>
									<PopoverContent align="end" className="w-80 space-y-3 p-3">
										<div className="grid grid-cols-2 gap-3">
											<div className="flex items-center justify-between gap-2">
												<Label htmlFor="f-streaming" className="text-xs">
													Streaming
												</Label>
												<Switch
													id="f-streaming"
													checked={filters.streaming}
													onCheckedChange={(v) =>
														setFilters((p) => ({ ...p, streaming: v }))
													}
												/>
											</div>
											<div className="flex items-center justify-between gap-2">
												<Label htmlFor="f-vision" className="text-xs">
													Vision
												</Label>
												<Switch
													id="f-vision"
													checked={filters.vision}
													onCheckedChange={(v) =>
														setFilters((p) => ({ ...p, vision: v }))
													}
												/>
											</div>
											<div className="flex items-center justify-between gap-2">
												<Label htmlFor="f-tools" className="text-xs">
													Tools
												</Label>
												<Switch
													id="f-tools"
													checked={filters.tools}
													onCheckedChange={(v) =>
														setFilters((p) => ({ ...p, tools: v }))
													}
												/>
											</div>
											{/* Reasoning filter removed */}
											{/* Cancellation filter removed */}
											<div className="flex items-center justify-between gap-2">
												<Label htmlFor="f-json" className="text-xs">
													JSON Output
												</Label>
												<Switch
													id="f-json"
													checked={filters.jsonOutput}
													onCheckedChange={(v) =>
														setFilters((p) => ({ ...p, jsonOutput: v }))
													}
												/>
											</div>
											{/* <div className="flex items-center justify-between gap-2">
											<Label htmlFor="f-moderated" className="text-xs">Moderation</Label>
											<select id="f-moderated" className="h-8 w-36 rounded-md border bg-background px-2 text-xs" value={filters.moderatedMode} onChange={(e) => setFilters((p) => ({ ...p, moderatedMode: e.target.value as any }))}>
												<option value="any">Any</option>
												<option value="moderated">Moderated</option>
												<option value="unmoderated">Unmoderated</option>
											</select>
										</div> */}
										</div>
										<div className="grid grid-cols-2 gap-3">
											<div>
												<Label htmlFor="f-provider" className="text-xs">
													Provider
												</Label>
												<Input
													id="f-provider"
													placeholder="e.g. openai"
													value={String(filters.providerQuery)}
													onChange={(e) =>
														setFilters((p) => ({
															...p,
															providerQuery: e.target.value,
														}))
													}
													className="h-8"
												/>
											</div>
											<div>
												<Label htmlFor="f-minctx" className="text-xs">
													Min context
												</Label>
												<Input
													id="f-minctx"
													type="number"
													min={0}
													value={String(filters.minContext)}
													onChange={(e) =>
														setFilters((p) => ({
															...p,
															minContext: e.target.value,
														}))
													}
													className="h-8"
												/>
											</div>
											<div>
												<Label htmlFor="f-maxprice" className="text-xs">
													Max prompt $/1K
												</Label>
												<Input
													id="f-maxprice"
													type="number"
													min={0}
													step="0.0001"
													value={String(filters.maxPromptPrice)}
													onChange={(e) =>
														setFilters((p) => ({
															...p,
															maxPromptPrice: e.target.value,
														}))
													}
													className="h-8"
												/>
											</div>
											<div>
												<Label htmlFor="f-status" className="text-xs">
													Status
												</Label>
												<select
													id="f-status"
													className="h-8 w-full rounded-md border bg-background px-2 text-sm"
													value={filters.status}
													onChange={(e) =>
														setFilters((p) => ({
															...p,
															status: e.target.value as ModelStatusFilter,
														}))
													}
												>
													<option value="any">Any</option>
													<option value="active">Active</option>
													<option value="deprecated">Deprecated</option>
													<option value="deactivated">Deactivated</option>
												</select>
											</div>
										</div>
										<div className="flex items-center justify-between">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={() =>
													setFilters({
														streaming: false,
														vision: false,
														tools: false,
														jsonOutput: false,
														moderatedMode: "any",
														status: "any",
														providerQuery: "",
														minContext: "",
														maxPromptPrice: "",
													})
												}
											>
												Reset
											</Button>
										</div>
									</PopoverContent>
								</Popover>
							</div>
						</div>
						<div className="flex h-full flex-col space-y-0.5 overflow-y-auto px-4 pb-6">
							{filteredModels.length > 0 ? (
								filteredModels.map((model) => (
									<div key={model.id} className="w-full">
										<div className="flex w-full items-center justify-between gap-2">
											<button
												type="button"
												className={cn(
													"flex w-full flex-1 cursor-pointer items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-accent",
													isModelSelected(model) &&
														"border border-primary/30 bg-accent",
													model.deactivated_at && "opacity-60",
												)}
												onClick={() => handleModelSelect(model)}
											>
												<div className="flex min-w-0 flex-1 items-center gap-2">
													<div className="truncate font-medium text-sm">
														{model.name}
													</div>
													{isModelSelected(model) && (
														<div className="size-2 flex-shrink-0 rounded-full bg-primary" />
													)}
												</div>
												<div className="text-muted-foreground text-xs">
													{formatPrice(model.pricing?.prompt || "0")}/1K
												</div>
											</button>

											{model.providers && model.providers.length > 1 && (
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 hover:bg-accent/50"
													onClick={(e) => {
														e.stopPropagation();
														toggleModelExpanded(model.id);
													}}
												>
													<CaretDown
														className={cn(
															"size-3 transition-transform",
															expandedModels.has(model.id) && "rotate-180",
														)}
													/>
												</Button>
											)}
										</div>

										{expandedModels.has(model.id) &&
											model.providers &&
											model.providers.length > 1 && (
												<div className="mt-1 ml-4 space-y-1 border-border border-l pl-3">
													{model.providers.map((provider) => (
														<button
															key={`${provider.providerId}-${provider.modelName}`}
															type="button"
															className={cn(
																"flex cursor-pointer items-center justify-between rounded px-2 py-1 text-xs transition-colors hover:bg-accent/50",
																isProviderSelected(
																	model,
																	provider.providerId,
																) && "bg-accent/70 ring-1 ring-primary/50",
															)}
															onClick={(e) => {
																e.stopPropagation();
																handleModelSelect(model, provider.providerId);
															}}
														>
															<span className="font-medium">
																{provider.providerId}
															</span>
															<span className="text-muted-foreground">
																{formatPrice(provider.pricing?.prompt || "0")}
																/1K
															</span>
														</button>
													))}
												</div>
											)}
									</div>
								))
							) : (
								<div className="flex h-full flex-col items-center justify-center p-6 text-center">
									<p className="mb-2 text-muted-foreground text-sm">
										No results found.
									</p>
								</div>
							)}
						</div>
					</DrawerContent>
				</Drawer>
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider>
			<DropdownMenu
				open={isDropdownOpen}
				onOpenChange={(open) => {
					setIsDropdownOpen(open);
					if (!open) {
						setSearchQuery("");
						setExpandedModels(new Set());
					}
				}}
			>
				<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
				<DropdownMenuContent
					className="flex h-[400px] w-[400px] flex-col space-y-0.5 overflow-visible px-0 pt-0"
					align="start"
					sideOffset={4}
					forceMount
					side="top"
				>
					<div className="sticky top-0 z-10 rounded-t-md border-b bg-background px-0 pt-0 pb-0">
						<div className="relative">
							<MagnifyingGlass className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								ref={searchInputRef}
								placeholder={`Search ${filteredModels.length} models...`}
								className="rounded-b-none border border-none pr-10 pl-8 shadow-none focus-visible:ring-0 dark:bg-popover"
                autoFocus
								value={searchQuery}
								onChange={handleSearchChange}
								onClick={(e) => e.stopPropagation()}
								onFocus={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
							/>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										type="button"
										aria-label="Open filters"
										className="absolute top-1.5 right-1.5 h-7 w-7 p-0 hover:bg-accent/50"
									>
										<SlidersHorizontal className="h-4 w-4" />
									</Button>
								</PopoverTrigger>
								<PopoverContent align="center" className="w-80 space-y-3 p-3">
									<div className="grid grid-cols-2 gap-3">
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="hf-streaming" className="text-xs">
												Streaming
											</Label>
											<Switch
												id="hf-streaming"
												checked={filters.streaming}
												onCheckedChange={(v) =>
													setFilters((p) => ({ ...p, streaming: v }))
												}
											/>
										</div>
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="hf-vision" className="text-xs">
												Vision
											</Label>
											<Switch
												id="hf-vision"
												checked={filters.vision}
												onCheckedChange={(v) =>
													setFilters((p) => ({ ...p, vision: v }))
												}
											/>
										</div>
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="hf-tools" className="text-xs">
												Tools
											</Label>
											<Switch
												id="hf-tools"
												checked={filters.tools}
												onCheckedChange={(v) =>
													setFilters((p) => ({ ...p, tools: v }))
												}
											/>
										</div>
										{/* Reasoning filter removed */}
										{/* Cancellation filter removed */}
										<div className="flex items-center justify-between gap-2">
											<Label htmlFor="hf-json" className="text-xs">
												JSON Output
											</Label>
											<Switch
												id="hf-json"
												checked={filters.jsonOutput}
												onCheckedChange={(v) =>
													setFilters((p) => ({ ...p, jsonOutput: v }))
												}
											/>
										</div>
										{/* <div className="flex items-center justify-between gap-2">
											<Label htmlFor="hf-moderated" className="text-xs">Moderation</Label>
											<select id="hf-moderated" className="h-8 w-36 rounded-md border bg-background px-2 text-xs" value={filters.moderatedMode} onChange={(e) => setFilters((p) => ({ ...p, moderatedMode: e.target.value as any }))}>
												<option value="any">Any</option>
												<option value="moderated">Moderated</option>
												<option value="unmoderated">Unmoderated</option>
											</select>
										</div> */}
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label htmlFor="hf-provider" className="text-xs">
												Provider
											</Label>
											<Input
												id="hf-provider"
												placeholder="e.g. openai"
												value={String(filters.providerQuery)}
												onChange={(e) =>
													setFilters((p) => ({
														...p,
														providerQuery: e.target.value,
													}))
												}
												className="h-8"
											/>
										</div>
										<div>
											<Label htmlFor="hf-minctx" className="text-xs">
												Min context
											</Label>
											<Input
												id="hf-minctx"
												type="number"
												min={0}
												value={String(filters.minContext)}
												onChange={(e) =>
													setFilters((p) => ({
														...p,
														minContext: e.target.value,
													}))
												}
												className="h-8"
											/>
										</div>
										<div>
											<Label htmlFor="hf-maxprice" className="text-xs">
												Max prompt $/1K
											</Label>
											<Input
												id="hf-maxprice"
												type="number"
												min={0}
												step="0.0001"
												value={String(filters.maxPromptPrice)}
												onChange={(e) =>
													setFilters((p) => ({
														...p,
														maxPromptPrice: e.target.value,
													}))
												}
												className="h-8"
											/>
										</div>
										<div>
											<Label htmlFor="hf-status" className="text-xs">
												Status
											</Label>
											<select
												id="hf-status"
												className="h-8 w-full rounded-md border bg-background px-2 text-sm"
												value={filters.status}
												onChange={(e) =>
													setFilters((p) => ({
														...p,
														status: e.target.value as ModelStatusFilter,
													}))
												}
											>
												<option value="any">Any</option>
												<option value="active">Active</option>
												<option value="deprecated">Deprecated</option>
												<option value="deactivated">Deactivated</option>
											</select>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() =>
												setFilters({
													streaming: false,
													vision: false,
													tools: false,
													jsonOutput: false,
													moderatedMode: "any",
													status: "any",
													providerQuery: "",
													minContext: "",
													maxPromptPrice: "",
												})
											}
										>
											Reset
										</Button>
									</div>
								</PopoverContent>
							</Popover>
						</div>
					</div>
					<div className="flex h-full flex-col space-y-0.5 overflow-y-auto px-1 pt-1 pb-0">
						{filteredModels.length > 0 ? (
							<>
								{searchQuery && (
									<div className="flex items-center justify-between px-3 py-2 text-xs">
										Showing {filteredModels.length} of {models.length} models
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													type="button"
													className="h-7 px-2"
												>
													<SlidersHorizontal className="h-4 w-4" />
												</Button>
											</PopoverTrigger>
											<PopoverContent
												align="end"
												className="w-80 space-y-3 p-3"
											>
												<div className="grid grid-cols-2 gap-3">
													<div className="flex items-center justify-between gap-2">
														<Label htmlFor="df-streaming" className="text-xs">
															Streaming
														</Label>
														<Switch
															id="df-streaming"
															checked={filters.streaming}
															onCheckedChange={(v) =>
																setFilters((p) => ({ ...p, streaming: v }))
															}
														/>
													</div>
													<div className="flex items-center justify-between gap-2">
														<Label htmlFor="df-vision" className="text-xs">
															Vision
														</Label>
														<Switch
															id="df-vision"
															checked={filters.vision}
															onCheckedChange={(v) =>
																setFilters((p) => ({ ...p, vision: v }))
															}
														/>
													</div>
													<div className="flex items-center justify-between gap-2">
														<Label htmlFor="df-tools" className="text-xs">
															Tools
														</Label>
														<Switch
															id="df-tools"
															checked={filters.tools}
															onCheckedChange={(v) =>
																setFilters((p) => ({ ...p, tools: v }))
															}
														/>
													</div>
													{/* Cancellation filter removed */}
													<div className="flex items-center justify-between gap-2">
														<Label htmlFor="df-json" className="text-xs">
															JSON Output
														</Label>
														<Switch
															id="df-json"
															checked={filters.jsonOutput}
															onCheckedChange={(v) =>
																setFilters((p) => ({ ...p, jsonOutput: v }))
															}
														/>
													</div>
													{/* <div className="flex items-center justify-between gap-2">
											<Label htmlFor="df-moderated" className="text-xs">Moderation</Label>
											<select id="df-moderated" className="h-8 w-36 rounded-md border bg-background px-2 text-xs" value={filters.moderatedMode} onChange={(e) => setFilters((p) => ({ ...p, moderatedMode: e.target.value as any }))}>
												<option value="any">Any</option>
												<option value="moderated">Moderated</option>
												<option value="unmoderated">Unmoderated</option>
											</select>
										</div> */}
												</div>
												<div className="grid grid-cols-2 gap-3">
													<div>
														<Label htmlFor="df-provider" className="text-xs">
															Provider
														</Label>
														<Input
															id="df-provider"
															placeholder="e.g. openai"
															value={String(filters.providerQuery)}
															onChange={(e) =>
																setFilters((p) => ({
																	...p,
																	providerQuery: e.target.value,
																}))
															}
															className="h-8"
														/>
													</div>
													<div>
														<Label htmlFor="df-minctx" className="text-xs">
															Min context
														</Label>
														<Input
															id="df-minctx"
															type="number"
															min={0}
															value={String(filters.minContext)}
															onChange={(e) =>
																setFilters((p) => ({
																	...p,
																	minContext: e.target.value,
																}))
															}
															className="h-8"
														/>
													</div>
													<div>
														<Label htmlFor="df-maxprice" className="text-xs">
															Max prompt $/1K
														</Label>
														<Input
															id="df-maxprice"
															type="number"
															min={0}
															step="0.0001"
															value={String(filters.maxPromptPrice)}
															onChange={(e) =>
																setFilters((p) => ({
																	...p,
																	maxPromptPrice: e.target.value,
																}))
															}
															className="h-8"
														/>
													</div>
													<div>
														<Label htmlFor="df-status" className="text-xs">
															Status
														</Label>
														<select
															id="df-status"
															className="h-8 w-full rounded-md border bg-background px-2 text-sm"
															value={filters.status}
															onChange={(e) =>
																setFilters((p) => ({
																	...p,
																	status: e.target.value as ModelStatusFilter,
																}))
															}
														>
															<option value="any">Any</option>
															<option value="active">Active</option>
															<option value="deprecated">Deprecated</option>
															<option value="deactivated">Deactivated</option>
														</select>
													</div>
												</div>
												<div className="flex items-center justify-between">
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() =>
															setFilters({
																streaming: false,
																vision: false,
																tools: false,
																jsonOutput: false,
																moderatedMode: "any",
																status: "any",
																providerQuery: "",
																minContext: "",
																maxPromptPrice: "",
															})
														}
													>
														Reset
													</Button>
												</div>
											</PopoverContent>
										</Popover>
									</div>
								)}
								{filteredModels.map(renderModelItem)}
							</>
						) : (
							<div className="flex h-full flex-col items-center justify-center p-6 text-center">
								<p className="mb-1 text-muted-foreground text-sm">
									No results found.
								</p>
								{searchQuery && (
									<p className="text-muted-foreground text-xs">
										Try searching for a different model or provider.
									</p>
								)}
							</div>
						)}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</TooltipProvider>
	);
}
