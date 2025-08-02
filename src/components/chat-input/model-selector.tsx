"use client";

import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { 
	CaretDown, 
	Key, 
	MagnifyingGlass,
	Eye,
	SpeakerHigh,
	Wrench,
	Brain,
	Globe,
	Clock,
	Lightbulb,
	CurrencyDollar,
	CalendarBlank,
	LinkSimple
} from "@phosphor-icons/react";
import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";
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
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { isModelLockedSync } from "~/lib/models/model-utils";
import type { ModelConfig } from "~/lib/models/types";
import { getProviders } from "~/lib/models/providers";
import { useModels } from "~/lib/models";
import { cn } from "~/lib/utils";

type ModelSelectorProps = {
	selectedModelId: string;
	setSelectedModelId: (modelId: string) => void;
	className?: string;
	isUserAuthenticated?: boolean;
};

type UserKeys = {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
	xaiKey?: string;
	perplexityKey?: string;
	exaKey?: string;
	firecrawlKey?: string;
};

export function ModelSelector({
	selectedModelId,
	setSelectedModelId,
	className,
	isUserAuthenticated = true,
}: ModelSelectorProps) {
	const { user } = useUser();
	const { models: allModels, isLoading: isLoadingModels } = useModels();
	const preferred = useQuery(
		api.userPreferences.getPreferredModels,
		user?.id ? {} : "skip",
	) as string[] | null | undefined;
	const models =
		preferred && preferred.length > 0
			? allModels.filter((m) => preferred.includes(m.id))
			: allModels;

	const currentModel = models.find((model) => model.id === selectedModelId);
	const isMobile = useBreakpoint(768);

	const [providers, setProviders] = useState<Array<{
		id: string;
		name: string;
		icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	}>>([]);
	
	const currentProvider = useMemo(() => {
		return providers.find((provider) => provider.id === currentModel?.providerId);
	}, [providers, currentModel]);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [selectedProModel, setSelectedProModel] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const searchInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
	}, []);

	useEffect(() => {
		const loadProviders = async () => {
			const providersList = await getProviders();
			setProviders(providersList);
		};
		
		loadProviders();
	}, []);

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

	const getKeys = useAction(api.userKeys.getKeys);
	const [userKeys, setUserKeys] = useState<UserKeys | undefined>(undefined);

	useEffect(() => {
		const fetchKeys = async () => {
			if (isUserAuthenticated) {
				const result = (await getKeys({})) as UserKeys;
				setUserKeys(result);
			} else {
				try {
					const { getAllKeys } = await import("~/lib/secure-local-keys");
					const localKeys = await getAllKeys();
					const formattedKeys: UserKeys = {
						openaiKey: localKeys.openaiKey,
						anthropicKey: localKeys.anthropicKey,
						googleKey: localKeys.googleKey,
						mistralKey: localKeys.mistralKey,
						xaiKey: localKeys.xaiKey,
						perplexityKey: localKeys.perplexityKey,
						exaKey: localKeys.exaKey,
						firecrawlKey: localKeys.firecrawlKey,
					};
					setUserKeys(formattedKeys);
				} catch (error) {
					console.error("Failed to get local keys:", error);
					setUserKeys({});
				}
			}
		};

		fetchKeys();

		const handleApiKeysChanged = async () => {
			await fetchKeys();
			
			try {
				const { getBestAvailableModel } = await import("~/lib/models/model-utils");
				const bestModel = await getBestAvailableModel(undefined, isUserAuthenticated);
				
				if (bestModel && (bestModel !== selectedModelId || !selectedModelId)) {
					setSelectedModelId(bestModel);
				}
			} catch (error) {
				console.error("Failed to auto-select model:", error);
			}
		};

		window.addEventListener("apiKeysChanged", handleApiKeysChanged);
		return () => {
			window.removeEventListener("apiKeysChanged", handleApiKeysChanged);
		};
	}, [getKeys, isUserAuthenticated, selectedModelId, setSelectedModelId]);

	const handleModelSelect = (model: ModelConfig) => {
		const locked = isModelLockedSync(model.id, userKeys, isUserAuthenticated);

		if (locked) {
			if (!isUserAuthenticated) {
				setSelectedProModel(model.id);
			} else {
				const provider = providers.find((p) => p.id === model.providerId);
				toast.error(`${model.name} requires a ${provider?.name || model.provider} API key. Please add one in Settings.`);
			}
			return;
		}

		setSelectedModelId(model.id);
		if (isMobile) {
			setIsDrawerOpen(false);
		} else {
			setIsDropdownOpen(false);
		}
	};

	const renderModelItemWithSubmenu = (model: ModelConfig) => {
		const provider = providers.find((p) => p.id === model.providerId);
		
		const locked = isModelLockedSync(model.id, userKeys, isUserAuthenticated);

		return (
            <DropdownMenuSub key={`dropdown-${model.id}`}>
                <DropdownMenuSubTrigger
					className={cn(
						"flex w-full items-center justify-between px-3 py-2 group",
						!locked && "hover:bg-accent cursor-pointer",
						selectedModelId === model.id && "bg-accent",
						locked && "cursor-not-allowed opacity-40 hover:bg-transparent grayscale",
					)}
					onClick={() => {
						if (locked) return;
						handleModelSelect(model);
					}}
				>
					<div className="flex items-center gap-3 flex-1 min-w-0">
						{provider?.icon && <provider.icon className="size-4 flex-shrink-0" />}
						<div className="flex-1 min-w-0">
							<div className="text-sm font-medium truncate">{model.name}</div>
							<div className="text-xs text-muted-foreground truncate">
								{model.provider} • {model.contextWindow?.toLocaleString()} tokens
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 flex-shrink-0">
						<div className="flex items-center gap-1">
							{model.vision && <Eye className="size-3 text-green-500" />}
							{model.audio && <SpeakerHigh className="size-3 text-blue-500" />}
							{model.reasoningText && <Brain className="size-3 text-purple-500" />}
							{model.tools && <Wrench className="size-3 text-orange-500" />}
						</div>
						
						{locked && (
							<div className="flex items-center gap-0.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 font-medium text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
								<Key className="size-2" />
								<span>API Key Required</span>
							</div>
						)}
					</div>
				</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
					<DropdownMenuSubContent 
						className="z-50 min-w-[320px] overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
						sideOffset={2}
						alignOffset={-5}
						avoidCollisions={false}
						sticky="always"
						style={{ position: 'fixed' }}
					>
						<div 
							className={cn(
								"p-3 border-b",
								!locked && "cursor-pointer hover:bg-accent/50",
								locked && "cursor-not-allowed opacity-40 grayscale"
							)}
							onClick={() => {
								if (locked) return;
								handleModelSelect(model);
							}}
						>
							<div className="flex items-center gap-2">
								{provider?.icon && <provider.icon className="size-5" />}
								<div>
									<div className="font-medium text-sm">{model.name}</div>
									<div className="text-xs text-muted-foreground">
										{model.provider} • {model.modelFamily}
									</div>
								</div>
							</div>
						</div>

						<div className="p-3 border-b">
							<p className="text-xs text-muted-foreground leading-relaxed">
								{model.description}
							</p>
						</div>

						<div className="p-3 border-b space-y-2">
							<div className="flex justify-between items-center">
								<span className="text-xs text-muted-foreground">Context</span>
								<span className="text-xs font-medium">
									{model.contextWindow?.toLocaleString()} tokens
								</span>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-xs text-muted-foreground">Input Pricing</span>
								<span className="text-xs font-medium">
									${model.inputCost} / {model.priceUnit}
								</span>
							</div>
							<div className="flex justify-between items-center">
								<span className="text-xs text-muted-foreground">Output Pricing</span>
								<span className="text-xs font-medium">
									${model.outputCost} / {model.priceUnit}
								</span>
							</div>
						</div>

						<div className="p-3 border-b">
							<div className="grid grid-cols-2 gap-2">
								<div className="flex items-center gap-1.5">
									<Eye className={cn("size-3", model.vision ? "text-green-500" : "text-muted-foreground")} />
									<span className="text-xs">Vision</span>
									<span className={cn("text-xs", model.vision ? "text-green-500" : "text-muted-foreground")}>
										{model.vision ? "✓" : "✗"}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<SpeakerHigh className={cn("size-3", model.audio ? "text-green-500" : "text-muted-foreground")} />
									<span className="text-xs">Audio</span>
									<span className={cn("text-xs", model.audio ? "text-green-500" : "text-muted-foreground")}>
										{model.audio ? "✓" : "✗"}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<Wrench className={cn("size-3", model.tools ? "text-green-500" : "text-muted-foreground")} />
									<span className="text-xs">Tools</span>
									<span className={cn("text-xs", model.tools ? "text-green-500" : "text-muted-foreground")}>
										{model.tools ? "✓" : "✗"}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<Brain className={cn("size-3", model.reasoningText ? "text-green-500" : "text-muted-foreground")} />
									<span className="text-xs">Reasoning</span>
									<span className={cn("text-xs", model.reasoningText ? "text-green-500" : "text-muted-foreground")}>
										{model.reasoningText ? "✓" : "✗"}
									</span>
								</div>
							</div>
						</div>

						{model.tags && model.tags.length > 0 && (
							<div className="p-3">
								<div className="flex flex-wrap gap-1">
									{model.tags.slice(0, 4).map((tag) => (
										<span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs">
											{tag}
										</span>
									))}
								</div>
							</div>
						)}
					</DropdownMenuSubContent>
				</DropdownMenuPortal>
            </DropdownMenuSub>
        );
	};

	const renderSimpleModelItem = (model: ModelConfig) => {
		const provider = providers.find((p) => p.id === model.providerId);
		
		const locked = isModelLockedSync(model.id, userKeys, isUserAuthenticated);

		return (
            <div
				key={`simple-${model.id}`}
				className={cn(
					"flex w-full items-center justify-between px-3 py-2 group",
					!locked && "hover:bg-accent cursor-pointer",
					selectedModelId === model.id && "bg-accent",
					locked && "cursor-not-allowed opacity-40 hover:bg-transparent grayscale",
				)}
				onClick={() => {
					if (locked) return;
					handleModelSelect(model);
				}}
			>
                <div className="flex items-center gap-3 flex-1 min-w-0">
					{provider?.icon && <provider.icon className="size-5 flex-shrink-0" />}
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium truncate">{model.name}</div>
						<div className="text-xs text-muted-foreground truncate">
							{model.provider} • {model.contextWindow?.toLocaleString()} tokens
						</div>
					</div>
				</div>
                <div className="flex items-center gap-2 flex-shrink-0">
					<div className="hidden sm:flex items-center gap-1">
						{model.vision && (
							<Tooltip>
								<TooltipTrigger>
									<Eye className="size-3 text-green-500" />
								</TooltipTrigger>
								<TooltipContent>Vision support</TooltipContent>
							</Tooltip>
						)}
						{model.audio && (
							<Tooltip>
								<TooltipTrigger>
									<SpeakerHigh className="size-3 text-blue-500" />
								</TooltipTrigger>
								<TooltipContent>Audio support</TooltipContent>
							</Tooltip>
						)}
						{model.reasoningText && (
							<Tooltip>
								<TooltipTrigger>
									<Brain className="size-3 text-purple-500" />
								</TooltipTrigger>
								<TooltipContent>Reasoning model</TooltipContent>
							</Tooltip>
						)}
						{model.tools && (
							<Tooltip>
								<TooltipTrigger>
									<Wrench className="size-3 text-orange-500" />
								</TooltipTrigger>
								<TooltipContent>Tool support</TooltipContent>
							</Tooltip>
						)}
					</div>

					{locked && (
						<div className="flex items-center gap-0.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 font-medium text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
							<Key className="size-2" />
							<span>API Key Required</span>
						</div>
					)}
				</div>
            </div>
        );
	};

	const filteredModels = models
		.filter((model) =>
			model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
			model.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
		)
		.sort((a, b) => {
			const aLocked = isModelLockedSync(a.id, userKeys, isUserAuthenticated);
			const bLocked = isModelLockedSync(b.id, userKeys, isUserAuthenticated);
			
			if (aLocked !== bLocked) {
				return aLocked ? 1 : -1;
			}
			
			if (a.provider !== b.provider) {
				return a.provider.localeCompare(b.provider);
			}
			
			return a.name.localeCompare(b.name);
		});

	const getPlaceholderText = () => {
		if (searchQuery) {
			return `Search ${filteredModels.length} models...`;
		}
		return `Search ${models.length} models...`;
	};

	if (isLoadingModels) {
		return null;
	}

	const trigger = (
		<div className="flex items-center gap-1">
			<Button
				variant="outline"
				className={cn("justify-between", className)}
				disabled={isLoadingModels}
			>
				<div className="flex items-center gap-2">
					{currentProvider?.icon && <currentProvider.icon className="size-5" />}
					<span>{currentModel?.name || "Select model"}</span>
				</div>
				<CaretDown className="size-4 opacity-50" />
			</Button>
		</div>
	);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.stopPropagation();
		setSearchQuery(e.target.value);
	};

	if (isMobile) {
		return (
			<Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
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
						{isLoadingModels ? (
							<div className="flex h-full flex-col items-center justify-center p-6 text-center">
								<p className="mb-2 text-muted-foreground text-sm">
									Loading models...
								</p>
							</div>
						) : filteredModels.length > 0 ? (
							filteredModels.map((model) => renderSimpleModelItem(model))
						) : (
							<div className="flex h-full flex-col items-center justify-center p-6 text-center">
								<p className="mb-2 text-muted-foreground text-sm">
									No results found.
								</p>
								<a
									href="https://github.com/montekkundan/chaichat/issues/new?title=Model%20Request%3A%20"
									target="_blank"
									rel="noopener noreferrer"
									className="text-muted-foreground text-sm underline"
								>
									Request a new model
								</a>
							</div>
						)}
					</div>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<div>
			<Tooltip>
				<DropdownMenu
					open={isDropdownOpen}
					onOpenChange={(open) => {
						setIsDropdownOpen(open);
						if (!open) {
							setSearchQuery("");
						}
					}}
				>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent>Switch model ⌘⇧P</TooltipContent>
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
							{isLoadingModels ? (
								<div className="flex h-full flex-col items-center justify-center p-6 text-center">
									<p className="mb-2 text-muted-foreground text-sm">
										Loading models...
									</p>
								</div>
							) : filteredModels.length > 0 ? (
								filteredModels.map((model) => renderModelItemWithSubmenu(model))
							) : (
								<div className="flex h-full flex-col items-center justify-center p-6 text-center">
									<p className="mb-1 text-muted-foreground text-sm">
										No results found.
									</p>
									<a
										href="https://github.com/montekkundan/chaichat/issues/new?title=Model%20Request%3A%20"
										target="_blank"
										rel="noopener noreferrer"
										className="text-muted-foreground text-sm underline"
									>
										Request a new model
									</a>
								</div>
							)}
						</div>
					</DropdownMenuContent>
				</DropdownMenu>
			</Tooltip>
		</div>
	);
}
