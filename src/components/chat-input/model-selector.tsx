"use client";

import { api } from "@/convex/_generated/api";
import { CaretDown, Key, MagnifyingGlass, Star } from "@phosphor-icons/react";
import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
// import { PopoverContentAuth } from "~/components/chat-input/popover-content-auth"
import { useBreakpoint } from "~/hooks/use-breakpoint";
import { FREE_MODELS_IDS, PREMIUM_MODEL_IDS } from "~/lib/config";
import type { ModelConfig } from "~/lib/models/types";
import { PROVIDERS } from "~/lib/providers";
import { useModels } from "~/lib/providers/models-provider";
import { cn } from "~/lib/utils";
// import { ProModelDialog } from "./pro-dialog"
// import { SubMenu } from "./sub-menu"

type ModelSelectorProps = {
	selectedModelId: string;
	setSelectedModelId: (modelId: string) => void;
	className?: string;
	isUserAuthenticated?: boolean;
};

// Define shape for keys returned from server
type UserKeys = {
	openaiKey?: string;
	anthropicKey?: string;
	googleKey?: string;
	mistralKey?: string;
	xaiKey?: string;
};

export function ModelSelector({
	selectedModelId,
	setSelectedModelId,
	className,
	isUserAuthenticated = true,
}: ModelSelectorProps) {
	const { models: allModels, isLoading: isLoadingModels } = useModels();
	const preferred = useQuery(api.userPreferences.getPreferredModels, {}) as
		| string[]
		| null
		| undefined;
	const models =
		preferred && preferred.length > 0
			? allModels.filter((m) => preferred.includes(m.id))
			: allModels;

	const currentModel = models.find((model) => model.id === selectedModelId);
	const currentProvider = PROVIDERS.find(
		(provider) => provider.id === currentModel?.providerId,
	);

	// Categorize models based on FREE_MODELS_IDS
	const freeModels = models.filter((model) =>
		FREE_MODELS_IDS.includes(model.id),
	);
	const proModels = models.filter(
		(model) => !FREE_MODELS_IDS.includes(model.id),
	);

	const isMobile = useBreakpoint(768);

	const [hoveredModel, setHoveredModel] = useState<string | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isProDialogOpen, setIsProDialogOpen] = useState(false);
	const [selectedProModel, setSelectedProModel] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	// Ref for input to maintain focus
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Add keyboard shortcut for ⌘⇧P to open model selector
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Using lowercase comparison to ensure it works regardless of case
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

	// Close submenu when dropdown closes
	useEffect(() => {
		if (!isDropdownOpen) {
			setHoveredModel(null);
		}
	}, [isDropdownOpen]);

	// This will show the submenu for the current model when the dropdown opens
	useEffect(() => {
		if (isDropdownOpen && selectedModelId) {
			setHoveredModel(selectedModelId);
		}
	}, [isDropdownOpen, selectedModelId]);

	// Fetch keys via Convex action once
	const getKeys = useAction(api.userKeys.getKeys);
	const [userKeys, setUserKeys] = useState<UserKeys | undefined>(undefined);

	useEffect(() => {
		(async () => {
			const result = (await getKeys({})) as UserKeys;
			setUserKeys(result);
		})();
	}, [getKeys]);

	const handleModelSelect = (model: ModelConfig) => {
		const isPro = !FREE_MODELS_IDS.includes(model.id);

		if (isPro && !isUserAuthenticated) {
			// Show auth dialog for unauthenticated users trying to use pro models
			setSelectedProModel(model.id);
			setIsProDialogOpen(true);
			return;
		}

		// For authenticated users or free models, just select the model
		setSelectedModelId(model.id);
		if (isMobile) {
			setIsDrawerOpen(false);
		} else {
			setIsDropdownOpen(false);
		}
	};

	const renderModelItem = (model: ModelConfig) => {
		const provider = PROVIDERS.find((p) => p.id === model.providerId);

		const isPremium = PREMIUM_MODEL_IDS.includes(model.id);
		const isFree = FREE_MODELS_IDS.includes(model.id);
		const isPro = !isFree; // non-free models are considered "Pro"

		// Map provider id to the corresponding key field returned by the API
		const providerKeyMap: Record<string, keyof UserKeys> = {
			openai: "openaiKey",
			claude: "anthropicKey",
			anthropic: "anthropicKey",
			gemini: "googleKey",
			google: "googleKey",
			mistral: "mistralKey",
			grok: "xaiKey",
			xai: "xaiKey",
		};

		const keyField = providerKeyMap[provider?.id ?? ""];
		const hasUserKey =
			keyField && userKeys ? Boolean(userKeys[keyField]) : false;

		// Locked if the user is not authenticated for pro OR it's a premium model without a user key
		const locked =
			(isPro && !isUserAuthenticated) || (isPremium && !hasUserKey);

		return (
			// biome-ignore lint/a11y/useKeyWithClickEvents: interactive div for list item
			<div
				key={model.id}
				className={cn(
					"flex w-full items-center justify-between px-3 py-2 hover:bg-accent",
					selectedModelId === model.id && "bg-accent",
					locked && "cursor-not-allowed opacity-60",
				)}
				onClick={() => {
					if (locked) return;
					handleModelSelect(model);
				}}
			>
				<div className="flex items-center gap-3">
					{provider?.icon && <provider.icon className="size-5" />}
					<span className="text-sm">{model.name}</span>
				</div>
				{isPro && (
					<div className="flex items-center gap-0.5 rounded-full border border-input bg-accent px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
						<Star className="size-2" />
						{isPremium && <Key className="size-2" />}
						<span>Pro</span>
					</div>
				)}
			</div>
		);
	};

	// Get the hovered model data
	const hoveredModelData = models.find((model) => model.id === hoveredModel);

	const filteredModels = models
		.filter((model) =>
			model.name.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		.sort((a, b) => {
			const aIsFree = FREE_MODELS_IDS.includes(a.id);
			const bIsFree = FREE_MODELS_IDS.includes(b.id);
			return aIsFree === bIsFree ? 0 : aIsFree ? -1 : 1;
		});

	if (isLoadingModels) {
		return null;
	}

	const trigger = (
		<Button
			variant="outline"
			className={cn("justify-between dark:bg-secondary", className)}
			disabled={isLoadingModels}
		>
			<div className="flex items-center gap-2">
				{currentProvider?.icon && <currentProvider.icon className="size-5" />}
				<span>{currentModel?.name || "Select model"}</span>
			</div>
			<CaretDown className="size-4 opacity-50" />
		</Button>
	);

	// Handle input change without losing focus
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		e.stopPropagation();
		setSearchQuery(e.target.value);
	};

	if (isMobile) {
		return (
			<>
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
									placeholder="Search models..."
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
								filteredModels.map((model) => renderModelItem(model))
							) : (
								<div className="flex h-full flex-col items-center justify-center p-6 text-center">
									<p className="mb-2 text-muted-foreground text-sm">
										No results found.
									</p>
									<a
										href="https://github.com/ibelick/zola/issues/new?title=Model%20Request%3A%20"
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
			</>
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
							setHoveredModel(null);
							setSearchQuery("");
						}
					}}
				>
					<TooltipTrigger asChild>
						<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
					</TooltipTrigger>
					<TooltipContent>Switch model ⌘⇧P</TooltipContent>
					<DropdownMenuContent
						className="flex h-[320px] w-[300px] flex-col space-y-0.5 overflow-visible px-0 pt-0"
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
									placeholder="Search models..."
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
								filteredModels.map((model) => renderModelItem(model))
							) : (
								<div className="flex h-full flex-col items-center justify-center p-6 text-center">
									<p className="mb-1 text-muted-foreground text-sm">
										No results found.
									</p>
									<a
										href="https://github.com/ibelick/zola/issues/new?title=Model%20Request%3A%20"
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
