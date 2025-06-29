import type { Message as MessageType } from "@ai-sdk/react";
import { useState } from "react";
import { MessageAssistant } from "./message-assistant";
import { MessageSystem } from "./message-system";
import { MessageUser } from "./message-user";

type MessageProps = {
	variant: MessageType["role"] | "system";
	children: string;
	id: string;
	message?: MessageType;
	attachments?: MessageType["experimental_attachments"];
	isLast?: boolean;
	onDelete: (id: string) => void;
	onEdit: (id: string, newText: string) => void;
	onReload: () => void;
	onRegenerate?: (model: string) => void;
	onBranch?: () => void;
	hasScrollAnchor?: boolean;
	parts?: MessageType["parts"];
	status?: "streaming" | "ready" | "submitted" | "error";
	model?: string;
};

export function Message({
	variant,
	children,
	id,
	message,
	attachments,
	isLast,
	onDelete,
	onEdit,
	onReload,
	onRegenerate,
	onBranch,
	hasScrollAnchor,
	parts,
	status,
	model,
}: MessageProps) {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = () => {
		navigator.clipboard.writeText(children);
		setCopied(true);
		setTimeout(() => setCopied(false), 500);
	};

	// Extract convexId from message object
	const convexId = (message as MessageType & { convexId?: string })?.convexId;

	if (variant === "user") {
		return (
			<MessageUser
				copied={copied}
				copyToClipboard={copyToClipboard}
				onReload={onReload}
				onEdit={onEdit}
				onDelete={onDelete}
				id={id}
				hasScrollAnchor={hasScrollAnchor}
				attachments={attachments}
			>
				{children}
			</MessageUser>
		);
	}

	if (variant === "assistant") {
		return (
			<MessageAssistant
				id={id}
				convexId={convexId}
				copied={copied}
				copyToClipboard={copyToClipboard}
				onReload={onReload}
				onRegenerate={onRegenerate}
				onBranch={onBranch}
				isLast={isLast}
				hasScrollAnchor={hasScrollAnchor}
				parts={parts}
				status={status}
				model={model}
			>
				{children}
			</MessageAssistant>
		);
	}

	if (variant === "system") {
		return <MessageSystem>{children}</MessageSystem>;
	}

	return null;
}
