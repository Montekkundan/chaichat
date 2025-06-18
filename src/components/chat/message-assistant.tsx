import type { Message as MessageAISDK } from "@ai-sdk/react";
import { ArrowClockwise, Check, Copy, GitBranch } from "@phosphor-icons/react";
import React, { useMemo, useState, useCallback } from "react";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
} from "~/components/prompt-kit/message";
import { cn } from "~/lib/utils";
import { getSources } from "./get-sources";
import { MessageVersions } from "./message-versions";
import { Reasoning } from "./reasoning";
import { RegenerateDropdown } from "./regenerate-dropdown";
import { SearchImages } from "./search-images";
import { SourcesList } from "./sources-list";
import { ToolInvocation } from "./tool-invocation";

type MessageAssistantProps = {
	children: string;
	id?: string;
	convexId?: string;
	isLast?: boolean;
	hasScrollAnchor?: boolean;
	copied?: boolean;
	copyToClipboard?: () => void;
	onReload?: () => void;
	onRegenerate?: (model: string) => void;
	onBranch?: () => void;
	parts?: MessageAISDK["parts"];
	status?: "streaming" | "ready" | "submitted" | "error";
	model?: string;
};

export const MessageAssistant = React.memo(function MessageAssistant({
	children,
	id,
	convexId,
	isLast,
	hasScrollAnchor,
	copied,
	copyToClipboard,
	onReload,
	onRegenerate,
	onBranch,
	parts,
	status,
	model,
}: MessageAssistantProps) {
	// const { preferences } = useUserPreferences()
	const sources = useMemo(() => getSources(parts), [parts]);

	const toolInvocationParts = useMemo(
		() => parts?.filter((part) => part.type === "tool-invocation"),
		[parts],
	);

	const reasoningParts = useMemo(
		() => parts?.find((part) => part.type === "reasoning"),
		[parts],
	);

	const contentNullOrEmpty = children === null || children === "";
	const isLastStreaming = status === "streaming" && isLast;

	const searchImageResults = useMemo(
		() =>
			parts
				?.filter(
					(part) =>
						part.type === "tool-invocation" &&
						part.toolInvocation?.state === "result" &&
						part.toolInvocation?.toolName === "imageSearch" &&
						part.toolInvocation?.result?.content?.[0]?.type === "images",
				)
				.flatMap((part) =>
					part.type === "tool-invocation" &&
						part.toolInvocation?.state === "result" &&
						part.toolInvocation?.toolName === "imageSearch" &&
						part.toolInvocation?.result?.content?.[0]?.type === "images"
						? (part.toolInvocation?.result?.content?.[0]?.results ?? [])
						: [],
				) ?? [],
		[parts],
	);

	const messageContent = useMemo(
		() => (
			<MessageContent
				className={cn(
					"prose dark:prose-invert relative min-w-full bg-transparent p-0",
					"prose-h2:mt-8 prose-h2:mb-3 prose-table:block prose-h1:scroll-m-20 prose-h2:scroll-m-20 prose-h3:scroll-m-20 prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-table:overflow-y-auto prose-h1:font-semibold prose-h2:font-medium prose-h3:font-medium prose-strong:font-medium prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base",
				)}
				markdown={true}
			>
				{children}
			</MessageContent>
		),
		[children],
	);

	const [activeModel, setActiveModel] = useState(model);

	const handleVersionChange = useCallback((m?: string) => {
		if (m) setActiveModel(m);
	}, []);

	return (
		<Message
			className={cn(
				"group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2",
				hasScrollAnchor && "min-h-scroll-anchor",
			)}
		>
			<div className={cn("flex min-w-full flex-col gap-2", isLast && "pb-8")}>
				{reasoningParts?.reasoning && (
					<Reasoning reasoning={reasoningParts.reasoning} />
				)}

				{toolInvocationParts && toolInvocationParts.length > 0 && (
					// preferences.showToolInvocations && (
					<ToolInvocation toolInvocations={toolInvocationParts} />
				)}

				{searchImageResults.length > 0 && (
					<SearchImages results={searchImageResults} />
				)}

				{id && !contentNullOrEmpty ? (
					<MessageVersions
						messageId={id}
						convexId={convexId}
						onVersionChange={handleVersionChange}
					>
						{messageContent}
					</MessageVersions>
				) : !contentNullOrEmpty ? (
					messageContent
				) : null}

				{sources && sources.length > 0 && <SourcesList sources={sources} />}

				{isLastStreaming || contentNullOrEmpty ? null : (
					<div className="flex items-center gap-2">
						<MessageActions
							className={cn(
								"-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100",
							)}
						>
							<MessageAction
								tooltip={copied ? "Copied!" : "Copy text"}
								side="bottom"
							>
								<button
									className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
									aria-label="Copy text"
									onClick={copyToClipboard}
									type="button"
								>
									{copied ? (
										<Check className="size-4" />
									) : (
										<Copy className="size-4" />
									)}
								</button>
							</MessageAction>
							<MessageAction
								tooltip="Branch chat"
								side="bottom"
								delayDuration={0}
							>
								<button
									className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
									aria-label="Branch chat"
									onClick={onBranch}
									type="button"
								>
									<GitBranch className="size-4" />
								</button>
							</MessageAction>
							<MessageAction
								tooltip="Regenerate"
								side="bottom"
								delayDuration={0}
							>
								<RegenerateDropdown
									currentModel={activeModel || ""}
									onRegenerate={(selectedModel: string) => {
										if (onRegenerate) {
											onRegenerate(selectedModel);
										}
									}}
								>
									<div className="flex items-center">
										<button
											className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
											aria-label="Regenerate"
											type="button"
										>
											<ArrowClockwise className="size-4" />
										</button>
										{activeModel && (
											<span className="ml-2 text-muted-foreground text-xs">
												{activeModel}
											</span>
										)}
									</div>
								</RegenerateDropdown>
							</MessageAction>
						</MessageActions>
					</div>
				)}
			</div>
		</Message>
	);
});
