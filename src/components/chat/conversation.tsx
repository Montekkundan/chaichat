import type { Message as MessageType } from "@ai-sdk/react";
import {
	ChatContainerContent,
	ChatContainerRoot,
} from "~/components/prompt-kit/chat-container";
import { Loader } from "~/components/prompt-kit/loader";
import { ScrollButton } from "~/components/prompt-kit/scroll-button";

type MessageWithModel = Omit<MessageType, "role"> & {
	role: "user" | "assistant" | "system" | "data";
	model?: string;
	convexId?: string;
};
import { useRef } from "react";
import { Message } from "./message";

type ConversationProps = {
	messages: MessageWithModel[];
	status?: "streaming" | "ready" | "submitted" | "error";
	onDelete: (id: string) => void;
	onEdit: (id: string, newText: string) => void;
	onReload: () => void;
	onBranch?: (messageIndex: number) => void;
};

export function Conversation({
	messages,
	status = "ready",
	onDelete,
	onEdit,
	onReload,
	onBranch,
}: ConversationProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const initialMessageCount = useRef(messages.length);

	if (status === "ready" && messages.length > initialMessageCount.current) {
		initialMessageCount.current = messages.length;
	}

	const activeMessages = messages.filter((m) => {
		if (m.role !== "assistant") return true;
		// biome-ignore lint/suspicious/noExplicitAny: runtime field
		return (m as any).isActive !== false;
	});

	// Sort messages by timestamp to ensure chronological order (oldest first, newest last)
	const sortedMessages = [...activeMessages].sort((a, b) => {
		// Use createdAt if available, otherwise fall back to _creationTime or current time
		const aTime = (
			"_creationTime" in a
				? a._creationTime
				: "createdAt" in a
					? a.createdAt
					: Date.now()
		) as number;
		const bTime = (
			"_creationTime" in b
				? b._creationTime
				: "createdAt" in b
					? b.createdAt
					: Date.now()
		) as number;
		return aTime - bTime;
	});

	if (!sortedMessages || sortedMessages.length === 0)
		return <div className="h-full w-full" />;

	return (
		<div ref={containerRef} className="relative flex h-full w-full flex-col">
			<div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
				<div className="flex h-app-header w-full bg-background lg:hidden lg:h-0" />
				<div className="mask-b-from-4% mask-b-to-100% flex h-app-header w-full bg-background lg:hidden" />
			</div>

			<ChatContainerRoot className="relative h-full w-full">
				<ChatContainerContent
					className="flex w-full flex-col items-center pt-20 pb-40"
					style={{
						scrollbarGutter: "stable both-edges",
						scrollbarWidth: "none",
					}}
				>
					{sortedMessages?.map((message, index) => {
						const isLast =
							index === sortedMessages.length - 1 && status !== "submitted";
						const hasScrollAnchor =
							isLast && sortedMessages.length > initialMessageCount.current;

						return (
							<Message
								key={message.id}
								id={message.id}
								message={message}
								variant={message.role}
								attachments={message.experimental_attachments}
								isLast={isLast}
								onDelete={onDelete}
								onEdit={onEdit}
								onReload={onReload}
								onBranch={onBranch ? () => onBranch(index) : undefined}
								hasScrollAnchor={hasScrollAnchor}
								parts={message.parts}
								status={status}
								model={(message as MessageWithModel).model}
							>
								{message.content}
							</Message>
						);
					})}
					{(status === "submitted" || status === "streaming") &&
						(sortedMessages.length === 0 ||
							(sortedMessages.length > 0 &&
								sortedMessages[sortedMessages.length - 1]?.role ===
									"user")) && (
							<div className="group flex min-h-scroll-anchor w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
								<Loader />
							</div>
						)}
				</ChatContainerContent>
				<div className="-translate-x-1/2 absolute bottom-34 left-1/2 transform">
					<ScrollButton className="shadow-sm" />
				</div>
			</ChatContainerRoot>
		</div>
	);
}
