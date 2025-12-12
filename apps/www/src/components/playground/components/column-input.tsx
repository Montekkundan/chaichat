"use client";

import { Paperclip } from "@phosphor-icons/react";
import { Globe, SendIcon, Square, X } from "lucide-react";
import type { UploadedFile } from "~/components/chat-input/file-items";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface ColumnInputProps {
	columnId: string;
	columnSource: "aigateway" | "llmgateway";
	columnSynced: boolean;
	columnIsStreaming: boolean;
	derivedStatus: "submitted" | "streaming" | "ready" | "error";
	files: UploadedFile[];
	onFileRemove: (file: UploadedFile) => void;
	onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	uploadDisabled: boolean;
	uploadDisabledReason?: string;
	onSend: () => void;
	onStop: () => void;
	onInputChange: (value: string) => void;
	currentInput: string;
	hasRequiredKey: boolean;
	isSubmitting: boolean;
	onToggleSearch: () => void;
	searchEnabled: boolean;
	searchDisabled?: boolean;
	isHydrated: boolean;
}

export function ColumnInput({
	columnId,
	columnSource,
	columnSynced,
	columnIsStreaming,
	derivedStatus,
	files,
	onFileRemove,
	onFileInputChange,
	fileInputRef,
	uploadDisabled,
	uploadDisabledReason,
	onSend,
	onStop,
	onInputChange,
	currentInput,
	hasRequiredKey,
	isSubmitting,
	onToggleSearch,
	searchEnabled,
	searchDisabled,
	isHydrated,
}: ColumnInputProps) {
	return (
		<div className="flex items-center gap-2 border-t bg-background-200 p-3 pr-2.5">
			<form
				className="relative flex w-full flex-col items-center"
				onSubmit={(event) => {
					event.preventDefault();
					onSend();
				}}
			>
				{files.length > 0 && (
					<div className="mb-2 flex w-full flex-wrap gap-2">
						{files.map((file, index) => (
							<FilePreview
								key={`${file.name}-${file.size}-${index}`}
								file={file}
								onRemove={() => onFileRemove(file)}
							/>
						))}
					</div>
				)}

				{files.length === 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<label
								htmlFor={`file-upload-${columnId}`}
								className={cn(
									"absolute left-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded hover:bg-muted/40",
									uploadDisabled && "cursor-not-allowed opacity-50",
								)}
								aria-disabled={uploadDisabled}
							>
								<input
									id={`file-upload-${columnId}`}
									ref={fileInputRef}
									type="file"
									multiple
									accept="image/*"
									onChange={onFileInputChange}
									className="hidden"
									disabled={uploadDisabled}
								/>
								<Paperclip className="size-4 text-muted-foreground hover:text-primary" />
							</label>
						</TooltipTrigger>
						{uploadDisabled ? (
							<TooltipContent side="top">
								<div className="text-xs">{uploadDisabledReason}</div>
							</TooltipContent>
						) : (
							<TooltipContent side="top">Attach images</TooltipContent>
						)}
					</Tooltip>
				)}

				<textarea
					placeholder={
						hasRequiredKey
							? columnSynced
								? "Type a synced message..."
								: "Type your message…"
							: `Please add your ${columnSource === "aigateway" ? "Vercel AI Gateway" : "LLM Gateway"} API key to start chatting`
					}
					value={currentInput}
					onChange={(event) => {
						onInputChange(event.target.value);
						const target = event.target as HTMLTextAreaElement;
						target.style.height = "auto";
						target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
					}}
					className={cn(
						"max-h-[120px] min-h-[38px] w-full resize-none overflow-y-auto rounded-md border bg-background-100 py-2 pr-9 text-sm focus:border-zinc-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:border-zinc-600",
						files.length === 0 ? "pl-10" : "pl-4",
					)}
					spellCheck="false"
					rows={1}
					style={{ fontFamily: "var(--font-geist-sans)", height: "38px", lineHeight: "1.5" }}
					disabled={!hasRequiredKey}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							if (!hasRequiredKey) return;
							onSend();
						}
					}}
				/>

				{columnIsStreaming || derivedStatus === "streaming" ? (
					<button
						type="button"
						aria-label="Stop"
						onClick={onStop}
						className="absolute right-2 bottom-2 inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-primary"
					>
						<Square className="h-4 w-4" />
					</button>
				) : (
					<button
						type="button"
						aria-label="Send Message"
						onClick={onSend}
						disabled={!hasRequiredKey || isSubmitting || !currentInput.trim()}
						className="absolute right-2 bottom-2 inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
					>
						<SendIcon className="h-4 w-4" />
					</button>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<span className="absolute right-9 bottom-2 inline-flex items-center justify-center">
							<button
								type="button"
								aria-label="Toggle Web Search"
								onClick={onToggleSearch}
								className="rounded-md p-1 text-muted-foreground hover:text-primary disabled:opacity-50"
								disabled={searchDisabled}
							>
								<Globe className={cn("h-4 w-4", searchEnabled ? "text-primary" : "text-muted-foreground")} />
							</button>
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">
						{isHydrated
							? searchDisabled
								? "Enable a search provider (Exa/Firecrawl) and add its API key"
								: searchEnabled
									? "Web search: On"
									: "Web search: Off"
							: "Web search"}
					</TooltipContent>
				</Tooltip>
			</form>
		</div>
	);
}

interface FilePreviewProps {
	file: UploadedFile;
	onRemove: () => void;
}

const FilePreview = ({ file, onRemove }: FilePreviewProps) => {
	return (
		<div className="relative mr-2 mb-0 flex items-center">
			<div className="flex w-full items-center gap-3 rounded-2xl border border-input bg-background p-2 pr-3 transition-colors hover:bg-accent">
				<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent-foreground">
					{file.contentType.includes("image") ? (
						<img src={file.url} alt={file.name} className="h-full w-full object-cover" />
					) : (
						<div className="text-center text-xs text-gray-400">
							{file.name.split(".").pop()?.toUpperCase()}
						</div>
					)}
				</div>
				<div className="flex flex-col overflow-hidden">
					<span className="truncate text-xs font-medium">{file.name}</span>
					<span className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)}kB</span>
				</div>
			</div>
			<button
				type="button"
				onClick={onRemove}
				className="absolute right-1 top-1 z-10 inline-flex size-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border-[3px] border-background bg-black text-white shadow-none transition-colors"
				aria-label="Remove file"
			>
				<X className="size-3" />
			</button>
		</div>
	);
};

export type { ColumnInputProps };
