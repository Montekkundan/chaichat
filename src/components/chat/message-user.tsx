"use client";

import type { UIMessage as MessageType } from "@ai-sdk/react";
import { Check, Copy } from "@phosphor-icons/react";
import Image from "next/image";
import { useRef, useState } from "react";
import {
	MorphingDialog,
	MorphingDialogClose,
	MorphingDialogContainer,
	MorphingDialogContent,
	MorphingDialogImage,
	MorphingDialogTrigger,
} from "~/components/chat/motion/morphing-dialog";
import {
	MessageAction,
	MessageActions,
	Message as MessageContainer,
	MessageContent,
} from "~/components/prompt-kit/message";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const getTextFromDataUrl = (dataUrl: string) => {
	const base64 = dataUrl.split(",")[1];
	return base64;
};

// Helper function to extract file attachments from v5 message parts
const getFileAttachments = (parts?: MessageType["parts"]) => {
	if (!parts) return [];
	return parts
		.filter((part) => part.type === "file")
		.map((part) => {
			if (part.type === "file") {
				return {
					name: part.filename || "Unknown file",
					url: part.url,
					contentType: part.mediaType,
				};
			}
			return null;
		})
		.filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);
};

export type MessageUserProps = {
	hasScrollAnchor?: boolean;
	parts?: MessageType["parts"];
	children: string;
	copied: boolean;
	copyToClipboard: () => void;
	onEdit: (id: string, newText: string) => void;
	onReload: () => void;
	onDelete: (id: string) => void;
	id: string;
};

export function MessageUser({
	hasScrollAnchor,
	parts,
	children,
	copied,
	copyToClipboard,
	onEdit,
	onReload,
	onDelete,
	id,
}: MessageUserProps) {
	const [editInput, setEditInput] = useState(children);
	const [isEditing, setIsEditing] = useState(false);
	const contentRef = useRef<HTMLDivElement>(null);

	// Extract file attachments from v5 message parts
	const attachments = getFileAttachments(parts);

	const handleEditCancel = () => {
		setIsEditing(false);
		setEditInput(children);
	};

	const handleSave = () => {
		if (onEdit) {
			onEdit(id, editInput);
		}
		onReload();
		setIsEditing(false);
	};

	const handleDelete = () => {
		onDelete(id);
	};

	return (
		<MessageContainer
			className={cn(
				"group flex w-full max-w-3xl flex-col items-end gap-0.5 px-6 pb-2",
				hasScrollAnchor && "min-h-scroll-anchor",
			)}
		>
			{/* --- Attachments display --- */}
			{(() => {
				if (!attachments || attachments.length === 0) return null;

				// Separate image attachments for special stacking
				const imageAttachments = attachments.filter((a) =>
					a.contentType?.startsWith("image"),
				);
				const otherAttachments = attachments.filter(
					(a) => !a.contentType?.startsWith("image"),
				);

				const rotationPalette = [-6, -2, 2, 6];

				return (
					<>
						{/* Stacked images */}
						{imageAttachments.length > 0 && (
							<div className="relative mb-2 h-28 w-40">
								{imageAttachments.map((attachment, idx) => {
									const isStack = imageAttachments.length > 1;
									const rotation = isStack
										? rotationPalette[idx % rotationPalette.length]
										: 0;
									const offset = isStack ? idx * 6 : 0;
									return (
										<MorphingDialog
											key={`${attachment.name}-${idx}`}
											transition={{
												type: "spring",
												stiffness: 280,
												damping: 18,
												mass: 0.3,
											}}
											images={imageAttachments}
											initialIndex={idx}
										>
											<MorphingDialogTrigger
												className="absolute top-0 left-0 z-10"
												imageIndex={idx}
											>
												<div
													style={{
														transform: `rotate(${rotation}deg) translate(${offset}px, ${-offset}px)`,
														zIndex: idx,
													}}
													className="origin-center"
												>
													<Image
														className="h-28 w-40 rounded-md object-cover shadow-md"
														src={attachment.url}
														alt={attachment.name || "Attachment"}
														width={160}
														height={112}
													/>
												</div>
											</MorphingDialogTrigger>
											<MorphingDialogContainer>
												<MorphingDialogContent className="relative rounded-lg">
													<MorphingDialogImage
														src={attachment.url}
														alt={attachment.name || ""}
														className="max-h-[90vh] max-w-[90vw] object-contain"
													/>
												</MorphingDialogContent>
												<MorphingDialogClose className="text-primary" />
											</MorphingDialogContainer>
										</MorphingDialog>
									);
								})}
							</div>
						)}

						{/* Non-image attachments or single images listed vertically as before */}
						{otherAttachments.map((attachment, index) => (
							<div
								className="flex flex-row gap-2"
								key={`${attachment.name}-other-${index}`}
							>
								{attachment.contentType?.startsWith("text") ? (
									<div className="mb-3 h-24 w-40 overflow-hidden rounded-md border p-2 text-primary text-xs">
										{getTextFromDataUrl(attachment.url)}
									</div>
								) : null}
							</div>
						))}
					</>
				);
			})()}
			{isEditing ? (
				<div
					className="relative flex min-w-[180px] flex-col gap-2 rounded-3xl bg-accent px-5 py-2.5"
					style={{
						width: contentRef.current?.offsetWidth,
					}}
				>
					<textarea
						className="w-full resize-none bg-transparent outline-none"
						value={editInput}
						onChange={(e) => setEditInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSave();
							}
							if (e.key === "Escape") {
								handleEditCancel();
							}
						}}
						// biome-ignore lint/a11y/noAutofocus: <explanation>
						autoFocus
					/>
					<div className="flex justify-end gap-2">
						<Button size="sm" variant="ghost" onClick={handleEditCancel}>
							Cancel
						</Button>
						<Button size="sm" onClick={handleSave}>
							Save
						</Button>
					</div>
				</div>
			) : (
				<MessageContent
					className="relative max-w-[70%] rounded-3xl bg-accent px-5 py-2.5"
					markdown={true}
					ref={contentRef}
					components={{
						code: ({ children }) => <>{children}</>,
						pre: ({ children }) => <>{children}</>,
						h1: ({ children }) => <p>{children}</p>,
						h2: ({ children }) => <p>{children}</p>,
						h3: ({ children }) => <p>{children}</p>,
						h4: ({ children }) => <p>{children}</p>,
						h5: ({ children }) => <p>{children}</p>,
						h6: ({ children }) => <p>{children}</p>,
						p: ({ children }) => <p>{children}</p>,
						li: ({ children }) => <p>- {children}</p>,
						ul: ({ children }) => <>{children}</>,
						ol: ({ children }) => <>{children}</>,
					}}
				>
					{children}
				</MessageContent>
			)}
			<MessageActions className="flex gap-0 opacity-0 transition-opacity duration-0 group-hover:opacity-100">
				<MessageAction tooltip={copied ? "Copied!" : "Copy text"} side="bottom">
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
				{/* <MessageAction
          tooltip={isEditing ? "Save" : "Edit"}
          side="bottom"
          delayDuration={0}
        >
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-transparent transition"
            aria-label="Edit"
            onClick={() => setIsEditing(!isEditing)}
            type="button"
          >
            <PencilSimple className="size-4" />
          </button>
        </MessageAction> */}
				{/* <MessageAction tooltip="Delete" side="bottom">
          <button
            className="hover:bg-accent/60 text-muted-foreground hover:text-foreground flex size-7.5 items-center justify-center rounded-full bg-transparent transition"
            aria-label="Delete"
            onClick={handleDelete}
            type="button"
          >
            <Trash className="size-4" />
          </button>
        </MessageAction> */}
			</MessageActions>
		</MessageContainer>
	);
}
