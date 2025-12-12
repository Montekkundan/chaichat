"use client";

import { LinkIcon, LinkSimpleBreakIcon } from "@phosphor-icons/react";
import {
	ChevronLeft,
	ChevronRight,
	MessageSquare,
	MessageSquareText,
	MoreHorizontal,
	Plus,
	RotateCcw,
	Settings,
	Trash2,
} from "lucide-react";
import { ModelSelector } from "~/components/chat-input/model-selector";
import { UnifiedConfigDropdown } from "~/components/model-config";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import type { ChatColumn } from "~/lib/providers/playground-provider";
import type { ReactNode } from "react";

interface ColumnHeaderProps {
	column: ChatColumn;
	columnSource: "aigateway" | "llmgateway";
	onModelChange: (modelId: string) => void;
	onSourceChange: (source: "aigateway" | "llmgateway") => void;
	onConfigChange: (config: Partial<ChatColumn["config"]>) => void;
	onAddColumn: () => void;
	columnsLength: number;
	maxColumns: number;
	onToggleSync: (id: string) => void;
	onToggleMergeContext: (id: string) => void;
	onClearColumn: (id: string) => void;
	onMoveLeft: (id: string) => void;
	onMoveRight: (id: string) => void;
	onRemoveColumn: (id: string) => void;
	canMoveLeft: boolean;
	canMoveRight: boolean;
	canRemove: boolean;
	isUserAuthenticated: boolean;
	additionalActions?: ReactNode;
}

export function ColumnHeader({
	column,
	columnSource,
	onModelChange,
	onSourceChange,
	onConfigChange,
	onAddColumn,
	columnsLength,
	maxColumns,
	onToggleSync,
	onToggleMergeContext,
	onClearColumn,
	onMoveLeft,
	onMoveRight,
	onRemoveColumn,
	canMoveLeft,
	canMoveRight,
	canRemove,
	isUserAuthenticated,
	additionalActions,
}: ColumnHeaderProps) {
	return (
		<div className="m-1 flex items-center justify-between py-2 pr-2 pl-3 backdrop-blur">
			<div className="min-w-0 flex-1">
				<div className="flex flex-1 flex-col">
					<div className="relative grid gap-2">
						<ModelSelector
							selectedModelId={column.modelId}
							setSelectedModelId={onModelChange}
							className="ease inline-flex h-[32px] w-full max-w-[288px] items-center justify-between truncate rounded-md border bg-background px-3 py-0.5 font-mono text-foreground leading-6 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
							isUserAuthenticated={isUserAuthenticated}
							source={columnSource}
							onSourceChange={onSourceChange}
						/>
					</div>
				</div>
			</div>

			<div className="ml-1 flex items-center">
				<div className="flex items-center">
					{column.synced && (
						<div className="mx-2 hidden h-6 items-center rounded-full bg-secondary px-3 text-md text-secondary-foreground text-sm lg:flex">
							Synced
						</div>
					)}

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
						onChange={onConfigChange}
						gateway={columnSource === "aigateway" ? "vercel-ai-gateway" : "llm-gateway"}
					>
						<Button aria-label="Model & Provider Settings" variant="ghost" size="icon">
							<span className="button_content__eYZtX button_flex___f_3o">
								<span className="pointer-events-none flex rounded-md p-2">
									<Settings className="h-4 w-4" />
								</span>
							</span>
						</Button>
					</UnifiedConfigDropdown>
				</div>

				<Tooltip>
					<TooltipTrigger asChild>
						<span>
							<Button
								variant="ghost"
								onClick={onAddColumn}
								disabled={columnsLength >= maxColumns}
								aria-disabled={columnsLength >= maxColumns}
							>
								<Plus className="h-4 w-4" />
							</Button>
						</span>
					</TooltipTrigger>
					{columnsLength >= maxColumns && (
						<TooltipContent sideOffset={6}>Cannot add more columns</TooltipContent>
					)}
				</Tooltip>

				<Button onClick={() => onToggleSync(column.id)} variant="ghost" size="icon">
					{column.synced ? <LinkIcon size={16} /> : <LinkSimpleBreakIcon size={16} />}
				</Button>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onToggleMergeContext(column.id)}
							aria-label="Toggle Context Merge"
						>
							{column.mergeContext ? (
								<MessageSquareText className="h-4 w-4 text-primary" />
							) : (
								<MessageSquare className="h-4 w-4 text-muted-foreground" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent sideOffset={6}>
						{column.mergeContext ? "Context merge: On" : "Context merge: Off"}
					</TooltipContent>
				</Tooltip>

				{additionalActions}

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button aria-label="Add Model" variant="ghost" size="icon">
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
							onClick={() => onClearColumn(column.id)}
							className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
						>
							<RotateCcw className="mr-2 h-4 w-4" />
							Clear Chat
						</button>
						<Separator className="my-1" />
						<DropdownMenuItem onClick={() => onMoveLeft(column.id)} disabled={!canMoveLeft}>
							<ChevronLeft className="mr-2 h-4 w-4" />
							Scroll Left
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => onMoveRight(column.id)} disabled={!canMoveRight}>
							<ChevronRight className="mr-2 h-4 w-4" />
							Scroll Right
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => onRemoveColumn(column.id)}
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
	);
}
