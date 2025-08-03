import type { UIMessage as MessageAISDK } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import { Check, Copy, GitBranch } from "@phosphor-icons/react";
import React, { useMemo } from "react";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
} from "~/components/prompt-kit/message";
import { cn } from "~/lib/utils";
import { formatModelAndProvider } from "~/lib/models/model-info";
import { Reasoning } from "./reasoning";
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
	onBranch,
	parts,
	status,
	model,
}: MessageAssistantProps) {
	// const { preferences } = useUserPreferences()

	// Extract sources from v5 parts - look for source-url and source-document parts
	const sources = useMemo(() => {
		if (!parts) return [];
		return parts
			.filter((part) => part.type === "source-url" || part.type === "source-document")
			.map((part) => {
				if (part.type === "source-url") {
					return { url: part.url, title: part.title };
				}
				if (part.type === "source-document") {
					return { url: "", title: part.title, content: part.filename };
				}
				return null;
			})
			.filter((source): source is NonNullable<typeof source> => source !== null);
	}, [parts]);

	const toolInvocationParts = useMemo(
		() => parts?.filter((part) => part.type.startsWith("tool-")) as ToolUIPart<any>[] | undefined,
		[parts],
	);

	const reasoningParts = useMemo(
		() => parts?.find((part) => part.type === "reasoning"),
		[parts],
	);

	const contentNullOrEmpty = children === null || children === "";
	const isLastStreaming = status === "streaming" && isLast;

	const searchImageResults: any[] = [];

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

	return (
		<Message
			className={cn(
				"group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2",
				hasScrollAnchor && "min-h-scroll-anchor",
			)}
		>
			<div className={cn("flex min-w-full flex-col gap-2", isLast && "pb-8")}>
				{reasoningParts?.text && (
					<Reasoning reasoningText={reasoningParts.text} />
				)}

				{toolInvocationParts && toolInvocationParts.length > 0 && (
					// preferences.showToolInvocations && (
					(<ToolInvocation toolInvocations={toolInvocationParts} />)
				)}

				{searchImageResults.length > 0 && (
					<SearchImages results={searchImageResults} />
				)}

				{!contentNullOrEmpty ? messageContent : null}

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

							{/* TODO: Improve branch functionality later */}
							{/* {onBranch && (
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
							)} */}

							{/* Model information display */}
							{model && (
								<div className="flex items-center justify-start">
									<span className="text-xs px-2">
										{formatModelAndProvider(model)}
									</span>
								</div>
							)}
						</MessageActions>
					</div>
				)}
			</div>
		</Message>
	);
});
