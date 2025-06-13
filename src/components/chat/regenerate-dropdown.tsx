"use client";

import { ArrowClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { FREE_MODELS_IDS } from "~/lib/config";
import type { ModelConfig } from "~/lib/models/types";
import { PROVIDERS } from "~/lib/providers";
import { useModels } from "~/lib/providers/models-provider";
import { cn } from "~/lib/utils";

type RegenerateDropdownProps = {
	currentModel: string;
	onRegenerate: (model: string) => void;
	children: React.ReactNode;
};

export function RegenerateDropdown({
	currentModel,
	onRegenerate,
	children,
}: RegenerateDropdownProps) {
	const { models, isLoading: isLoadingModels } = useModels();
	const [searchQuery, setSearchQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);

	const filteredModels = models
		.filter((model) =>
			model.name.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		.sort((a, b) => {
			const aIsFree = FREE_MODELS_IDS.includes(a.id);
			const bIsFree = FREE_MODELS_IDS.includes(b.id);
			return aIsFree === bIsFree ? 0 : aIsFree ? -1 : 1;
		});

	const currentModelData = models.find((model) => model.id === currentModel);

	const handleRegenerate = (modelId: string) => {
		onRegenerate(modelId);
		setIsOpen(false);
		setSearchQuery("");
	};

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
			<DropdownMenuContent
				className="max-h-96 w-80 overflow-hidden p-0"
				align="end"
				side="top"
			>
				<div className="border-b p-3">
					<div className="mb-3 flex items-center gap-2">
						<ArrowClockwise className="size-4 text-muted-foreground" />
						<span className="font-medium text-sm">Regenerate Response</span>
					</div>

					{/* Current model retry button */}
					<button
						onClick={() => handleRegenerate(currentModel)}
						className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-accent"
						type="button"
					>
						<span className="text-muted-foreground text-sm">Retry with:</span>
						<span className="font-medium text-sm">
							{currentModelData?.name || currentModel}
						</span>
					</button>
				</div>

				<DropdownMenuSeparator />

				<div className="p-2">
					<div className="mb-2 px-2 text-muted-foreground text-xs">
						Or try with a different model:
					</div>

					{/* Search */}
					<div className="relative mb-2">
						<MagnifyingGlass className="absolute top-2.5 left-2.5 h-3 w-3 text-muted-foreground" />
						<Input
							placeholder="Search models..."
							className="h-8 pl-7 text-sm"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							onClick={(e) => e.stopPropagation()}
						/>
					</div>

					{/* Models list */}
					<div className="max-h-48 overflow-y-auto">
						{isLoadingModels ? (
							<div className="p-3 text-center text-muted-foreground text-xs">
								Loading models...
							</div>
						) : filteredModels.length > 0 ? (
							filteredModels.map((model) => {
								const provider = PROVIDERS.find(
									(provider) => provider.id === model.providerId,
								);
								const isPro = !FREE_MODELS_IDS.includes(model.id);
								const isCurrentModel = model.id === currentModel;

								return (
									<DropdownMenuItem
										key={model.id}
										onClick={() => handleRegenerate(model.id)}
										className={cn(
											"flex w-full cursor-pointer items-center justify-between px-2 py-1.5",
											isCurrentModel && "cursor-not-allowed opacity-50",
										)}
										disabled={isCurrentModel}
									>
										<div className="flex min-w-0 items-center gap-2">
											{provider?.icon && (
												<provider.icon className="size-3 flex-shrink-0" />
											)}
											<span className="truncate text-xs">{model.name}</span>
										</div>
										{isPro && (
											<span className="flex-shrink-0 text-[10px] text-muted-foreground">
												Pro
											</span>
										)}
									</DropdownMenuItem>
								);
							})
						) : (
							<div className="p-3 text-center text-muted-foreground text-xs">
								No models found
							</div>
						)}
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
