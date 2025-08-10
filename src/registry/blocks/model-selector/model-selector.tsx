"use client";

import { CaretDown, MagnifyingGlass, Info, CheckCircle, XCircle } from "@phosphor-icons/react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { cn } from "~/lib/utils";

type ModelSelectorProps = {
	selectedModelId: string;
	setSelectedModelId: (modelId: string) => void;
	selectedProvider?: string;
	setSelectedProvider?: (providerId: string) => void;
	className?: string;
};

type LLMGatewayModel = {
	id: string;
	name: string;
	created?: number;
	description?: string;
	family?: string;
	architecture?: {
		input_modalities?: string[];
		output_modalities?: string[];
		tokenizer?: string;
	};
	top_provider?: {
		is_moderated?: boolean;
	};
	providers?: Array<{
		providerId: string;
		modelName: string;
		pricing?: {
			prompt?: string;
			completion?: string;
			image?: string;
		};
		streaming?: boolean;
		vision?: boolean;
		cancellation?: boolean;
		tools?: boolean;
	}>;
	pricing?: {
		prompt?: string;
		completion?: string;
		image?: string;
		request?: string;
		input_cache_read?: string;
		input_cache_write?: string;
		web_search?: string;
		internal_reasoning?: string;
	};
	context_length?: number;
	per_request_limits?: {
		[key: string]: string;
	};
	supported_parameters?: string[];
	json_output?: boolean;
	deprecated_at?: string;
	deactivated_at?: string;
};

export function ModelSelector({
	selectedModelId,
	setSelectedModelId,
	selectedProvider,
	setSelectedProvider,
	className,
}: ModelSelectorProps) {
	const [models, setModels] = useState<LLMGatewayModel[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
	const isMobile = useBreakpoint(768);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const modelsCache = useRef<{
		data: LLMGatewayModel[] | null;
		timestamp: number;
	}>({
		data: null,
		timestamp: 0,
	});

	useEffect(() => {
		const fetchModels = async () => {
			const now = Date.now();
			const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
			
			if (modelsCache.current.data && 
				(now - modelsCache.current.timestamp) < CACHE_DURATION) {
				setModels(modelsCache.current.data);
				setIsLoading(false);
				return;
			}

			try {
				setIsLoading(true);
				setError(null);
				const response = await fetch("/api/models");
				
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				const data = await response.json();
				
				if (data.models && Array.isArray(data.models)) {
					modelsCache.current = {
						data: data.models,
						timestamp: now,
					};
					
					setModels(data.models);
					
					if (!selectedModelId && data.models.length > 0) {
						setSelectedModelId(data.models[0].id);
					}
				} else {
					throw new Error("Invalid response format from models API");
				}
			} catch (error) {
				console.error("Failed to fetch models:", error);
				setError(error instanceof Error ? error.message : "Failed to load models");
			} finally {
				setIsLoading(false);
			}
		};

		fetchModels();
	}, [selectedModelId, setSelectedModelId]);

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

	const isModelSelected = useCallback((model: LLMGatewayModel) => {
		if (selectedModelId === model.id || selectedModelId === model.name) return true;
		
		if (selectedModelId.includes('/')) {
			const firstSlashIndex = selectedModelId.indexOf('/');
			const provider = selectedModelId.substring(0, firstSlashIndex);
			const modelName = selectedModelId.substring(firstSlashIndex + 1);
			
			if (!provider || !modelName) return false;
			
			return !!model.providers?.some(p => 
				p.providerId === provider && (
					p.modelName === modelName || 
					p.modelName.endsWith(`/${modelName}`) ||
					modelName === p.modelName
				)
			);
		}
		
		return false;
	}, [selectedModelId]);	const isProviderSelected = useCallback((model: LLMGatewayModel, providerId: string) => {
		if (!selectedModelId.includes('/')) return false;
		
		const firstSlashIndex = selectedModelId.indexOf('/');
		const selectedProvider = selectedModelId.substring(0, firstSlashIndex);
		const selectedModelName = selectedModelId.substring(firstSlashIndex + 1);
		
		const provider = model.providers?.find(p => p.providerId === providerId);
		return selectedProvider === providerId && 
			   provider && 
			   provider.modelName === selectedModelName;
	}, [selectedModelId]);

	const toggleModelExpanded = useCallback((modelId: string) => {
		setExpandedModels(prev => {
			const newSet = new Set(prev);
			if (newSet.has(modelId)) {
				newSet.delete(modelId);
			} else {
				newSet.add(modelId);
			}
			return newSet;
		});
	}, []);

	const handleModelSelect = useCallback((model: LLMGatewayModel, providerId?: string) => {
		const providerToUse = providerId || model.providers?.[0]?.providerId;
		const selectedProvider = model.providers?.find(p => p.providerId === providerToUse);
		
		const modelName = selectedProvider?.modelName || model.name;
		const modelString = providerToUse ? `${providerToUse}/${modelName}` : model.id;
		setSelectedModelId(modelString);
		
		if (providerToUse && setSelectedProvider) {
			setSelectedProvider(providerToUse);
		}
		
		if (isMobile) {
			setIsDrawerOpen(false);
		} else {
			setIsDropdownOpen(false);
		}
	}, [isMobile, setSelectedModelId, setSelectedProvider]);

	const filteredModels = useMemo(() => 
		models.filter((model) => {
			const query = searchQuery.toLowerCase();
			return (
				model.name.toLowerCase().includes(query) ||
				model.family?.toLowerCase().includes(query) ||
				model.description?.toLowerCase().includes(query) ||
				model.id.toLowerCase().includes(query) ||
				model.providers?.some(p => p.providerId.toLowerCase().includes(query)) ||
				model.supported_parameters?.some(p => p.toLowerCase().includes(query))
			);
		}).sort((a, b) => {
			const aActive = !a.deactivated_at && !a.deprecated_at;
			const bActive = !b.deactivated_at && !b.deprecated_at;
			if (aActive && !bActive) return -1;
			if (!aActive && bActive) return 1;
			
			const aProviders = a.providers?.length || 0;
			const bProviders = b.providers?.length || 0;
			if (aProviders !== bProviders) return bProviders - aProviders;
			
			return (b.context_length || 0) - (a.context_length || 0);
		}), [models, searchQuery]);

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
		
		if (selectedModelId.includes('/')) {
			const firstSlashIndex = selectedModelId.indexOf('/');
			const provider = selectedModelId.substring(0, firstSlashIndex);
			const modelName = selectedModelId.substring(firstSlashIndex + 1);
			
			const matchingModel = models.find(model => 
				model.providers?.some(p => 
					p.providerId === provider && p.modelName === modelName
				)
			);
			
			if (matchingModel) {
				return matchingModel.name;
			}
			
			const modelPart = modelName?.split('/').pop();
			return modelPart || selectedModelId;
		}
		
		const model = models.find(m => m.id === selectedModelId || m.name === selectedModelId);
		return model ? model.name : selectedModelId;
	}, [selectedModelId, models]);

	const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		e.stopPropagation();
		setSearchQuery(e.target.value);
	}, []);

	const renderModelTooltip = useCallback((model: LLMGatewayModel) => (
		<div className="w-80 space-y-0 bg-popover text-popover-foreground">
			<div className="p-4 pb-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex-1 min-w-0">
						<div className="font-semibold text-sm text-foreground">{model.name}</div>
						<div className="text-xs text-muted-foreground mt-1 leading-relaxed">
							{model.description || "No description available"}
						</div>
					</div>
					<span className={cn(
						"text-xs px-2 py-1 rounded-full font-medium flex-shrink-0",
						model.deactivated_at 
							? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" 
							: model.deprecated_at 
							? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" 
							: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
					)}>
						{getStatusText(model)}
					</span>
				</div>
			</div>

			<Separator />

			<div className="p-4 py-3">
				<div className="grid grid-cols-2 gap-4 text-xs">
					<div>
						<div className="font-medium mb-2 text-foreground">Architecture</div>
						<div className="space-y-1.5 text-muted-foreground">
							<div><span className="font-medium">Input:</span> {model.architecture?.input_modalities?.join(", ") || "text"}</div>
							<div><span className="font-medium">Output:</span> {model.architecture?.output_modalities?.join(", ") || "text"}</div>
							<div><span className="font-medium">Tokenizer:</span> {model.architecture?.tokenizer || "GPT"}</div>
						</div>
					</div>
					
					<div>
						<div className="font-medium mb-2 text-foreground">Features</div>
						<div className="space-y-1.5">
							<div className="flex items-center gap-2 text-muted-foreground">
								{model.providers?.[0]?.streaming ? 
									<CheckCircle className="size-3 text-green-500 flex-shrink-0" /> : 
									<XCircle className="size-3 text-red-500 flex-shrink-0" />
								}
								<span>Streaming</span>
							</div>
							<div className="flex items-center gap-2 text-muted-foreground">
								{model.providers?.[0]?.vision ? 
									<CheckCircle className="size-3 text-green-500 flex-shrink-0" /> : 
									<XCircle className="size-3 text-red-500 flex-shrink-0" />
								}
								<span>Vision</span>
							</div>
							<div className="flex items-center gap-2 text-muted-foreground">
								{model.providers?.[0]?.tools ? 
									<CheckCircle className="size-3 text-green-500 flex-shrink-0" /> : 
									<XCircle className="size-3 text-red-500 flex-shrink-0" />
								}
								<span>Function Calling</span>
							</div>
							<div className="flex items-center gap-2 text-muted-foreground">
								{model.json_output ? 
									<CheckCircle className="size-3 text-green-500 flex-shrink-0" /> : 
									<XCircle className="size-3 text-red-500 flex-shrink-0" />
								}
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
						<div className="font-medium text-xs mb-3 text-foreground">
							Available Providers ({model.providers.length})
						</div>
						<div className="space-y-2">
						{model.providers.slice(0, 3).map((provider) => (
							<button 
								key={`${model.id}-${provider.providerId}`}
								type="button"
								className={cn(
									"text-xs bg-muted/50 rounded-md px-3 py-2 cursor-pointer hover:bg-muted transition-colors",
									isProviderSelected(model, provider.providerId) && "ring-2 ring-primary bg-primary/10"
								)}
								onClick={(e) => {
									e.stopPropagation();
									handleModelSelect(model, provider.providerId);
								}}
							>
									<div className="font-medium text-foreground">{provider.providerId}</div>
									<div className="text-muted-foreground mt-0.5">
										{formatPrice(provider.pricing?.prompt || "0")}/1K tokens
									</div>
							</button>
							))}
							{model.providers.length > 3 && (
								<div className="text-xs text-muted-foreground pl-3">
									+{model.providers.length - 3} more providers (click model to see all)
								</div>
							)}
						</div>
					</div>
				</>
			)}

			{model.supported_parameters && model.supported_parameters.length > 0 && (
				<>
					<Separator />
					<div className="p-4 py-3">
						<div className="font-medium text-xs mb-3 text-foreground">Supported Parameters</div>
						<div className="flex flex-wrap gap-1.5">
							{model.supported_parameters.slice(0, 8).map((param) => (
								<Badge key={param} variant="outline" className="text-xs h-5 px-2">
									{param}
								</Badge>
							))}
							{model.supported_parameters.length > 8 && (
								<Badge variant="outline" className="text-xs h-5 px-2">
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
						<div className={cn(
							"flex items-center gap-2 text-xs p-2 rounded-md",
							model.deactivated_at 
								? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800" 
								: "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800"
						)}>
							<Info className="size-3 flex-shrink-0" />
							<span>
								{model.deactivated_at 
									? "This model has been deactivated and is no longer available."
									: "This model is deprecated and may be removed in the future."
								}
							</span>
						</div>
					</div>
				</>
			)}
		</div>
	), [getStatusText, isProviderSelected, handleModelSelect, formatPrice]);

	const renderModelItem = useCallback((model: LLMGatewayModel) => (
		<TooltipProvider key={model.id}>
			<Tooltip delayDuration={300}>
				<TooltipTrigger asChild>
					<div className="w-full">
						<div className="flex w-full items-center justify-between gap-2">
							<div
								role="button"
								tabIndex={0}
								className={cn(
									"flex w-full items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent transition-colors flex-1 rounded-md",
									isModelSelected(model) && "bg-accent border border-primary/30",
									model.deactivated_at && "opacity-60"
								)}
								onClick={() => handleModelSelect(model)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										handleModelSelect(model);
									}
								}}
							>
								<div className="flex items-center gap-2 min-w-0 flex-1">
									<div className="text-sm font-medium truncate">{model.name}</div>
									{isModelSelected(model) && (
										<div className="size-2 rounded-full bg-primary flex-shrink-0" />
									)}
								</div>
								<div className="text-xs text-muted-foreground">
									{formatPrice(model.pricing?.prompt || "0")}/1K
								</div>
							</div>
							
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
											expandedModels.has(model.id) && "rotate-180"
										)} 
									/>
								</Button>
							)}
						</div>
						
						{expandedModels.has(model.id) && 
						 model.providers && model.providers.length > 1 && (
							<div className="ml-4 border-l border-border pl-3 space-y-1">
							{model.providers.map((provider) => (
								<button
									key={`${model.id}-${provider.providerId}`}
									type="button"
									className={cn(
										"flex items-center justify-between px-2 py-1 text-xs cursor-pointer hover:bg-accent/50 rounded transition-colors",
										isProviderSelected(model, provider.providerId) && "bg-accent/70 ring-1 ring-primary/50"
									)}
									onClick={(e) => {
										e.stopPropagation();
										handleModelSelect(model, provider.providerId);
									}}
								>
										<span className="font-medium">{provider.providerId}</span>
										<span className="text-muted-foreground">
											{formatPrice(provider.pricing?.prompt || "0")}/1K
										</span>
								</button>
								))}
							</div>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="right" className="p-0 bg-popover border border-border">
					{renderModelTooltip(model)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	), [isModelSelected, handleModelSelect, formatPrice, expandedModels, toggleModelExpanded, isProviderSelected, renderModelTooltip]);

	const trigger = useMemo(() => (
		<Button variant="outline" className={cn("justify-between", className)}>
			<div className="flex items-center gap-2 min-w-0 flex-1">
				<div className="text-sm font-medium truncate">
					{getDisplayText()}
				</div>
			</div>
			<CaretDown className="size-4 opacity-50 ml-2 flex-shrink-0" />
		</Button>
	), [className, getDisplayText]);

	if (isLoading) {
		return (
			<Button variant="outline" className={cn("justify-between", className)} disabled>
				<span>Loading models...</span>
				<CaretDown className="size-4 opacity-50" />
			</Button>
		);
	}

	if (error) {
		return (
			<Button variant="outline" className={cn("justify-between", className)} disabled>
				<span className="text-red-500">Error loading models</span>
				<CaretDown className="size-4 opacity-50" />
			</Button>
		);
	}

	if (isMobile) {
		return (
			<TooltipProvider>
				<Drawer open={isDrawerOpen} onOpenChange={(open) => {
					setIsDrawerOpen(open);
					if (!open) {
						setExpandedModels(new Set()); // Clear expanded models when closing
					}
				}}>
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
									className="pl-8"
									value={searchQuery}
									onChange={handleSearchChange}
									onClick={(e) => e.stopPropagation()}
								/>
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
													"flex w-full items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent transition-colors rounded-md flex-1",
													isModelSelected(model) && "bg-accent border border-primary/30",
													model.deactivated_at && "opacity-60"
												)}
								onClick={() => handleModelSelect(model)}
											>
												<div className="flex items-center gap-2 min-w-0 flex-1">
													<div className="text-sm font-medium truncate">{model.name}</div>
													{isModelSelected(model) && (
														<div className="size-2 rounded-full bg-primary flex-shrink-0" />
													)}
												</div>
												<div className="text-xs text-muted-foreground">
													{formatPrice(model.pricing?.prompt || "0")}/1K
												</div>
											</div>
											
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
															expandedModels.has(model.id) && "rotate-180"
														)} 
													/>
												</Button>
											)}
										</div>
										
										{expandedModels.has(model.id) && 
										 model.providers && model.providers.length > 1 && (
											<div className="ml-4 mt-1 border-l border-border pl-3 space-y-1">
								{model.providers.map((provider) => (
									<div
										key={`${model.id}-${provider.providerId}`}
										role="button"
										tabIndex={0}
										className={cn(
											"flex items-center justify-between px-2 py-1 text-xs cursor-pointer hover:bg-accent/50 rounded transition-colors",
											isProviderSelected(model, provider.providerId) && "bg-accent/70 ring-1 ring-primary/50"
										)}
										onClick={(e) => {
											e.stopPropagation();
											handleModelSelect(model, provider.providerId);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												e.stopPropagation();
												handleModelSelect(model, provider.providerId);
											}
										}}
									>
														<span className="font-medium">{provider.providerId}</span>
														<span className="text-muted-foreground">
															{formatPrice(provider.pricing?.prompt || "0")}/1K
														</span>
													</div>
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
						setExpandedModels(new Set()); // Clear expanded models when closing
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
								placeholder={`Search ${models.length} models...`}
								className="rounded-b-none border border-none pl-8 shadow-none focus-visible:ring-0 dark:bg-popover"
								value={searchQuery}
								onChange={handleSearchChange}
								onClick={(e) => e.stopPropagation()}
								onFocus={(e) => e.stopPropagation()}
								onKeyDown={(e) => e.stopPropagation()}
							/>
						</div>
					</div>
					<div className="flex h-full flex-col space-y-0.5 overflow-y-auto px-1 pt-1 pb-0">
						{filteredModels.length > 0 ? (
							<>
								{searchQuery && (
									<div className="px-3 py-2 text-xs text-muted-foreground border-b">
										Showing {filteredModels.length} of {models.length} models
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
									<p className="text-xs text-muted-foreground">
										Try searching for a different model or provider.
									</p>
								)}
							</button>
						)}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</TooltipProvider>
	);
}