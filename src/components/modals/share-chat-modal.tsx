"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { toast } from "~/components/ui/toast";
import { Button } from "../ui/button";
import { cn } from "~/lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { Check, Copy as CopyIcon } from "lucide-react";

interface ShareChatModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	chatId: string;
	isPublic?: boolean;
	onToggle: (newValue: boolean) => Promise<void>;
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	return (
		<TooltipProvider delayDuration={0}>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="outline"
						size="icon"
						className="disabled:opacity-100 relative"
						onClick={handleCopy}
						aria-label={copied ? "Copied" : "Copy to clipboard"}
						disabled={copied}
					>
						<div
							className={cn(
								"transition-all",
								copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
							)}
						>
							<Check className="stroke-emerald-500" size={16} strokeWidth={2} aria-hidden="true" />
						</div>
						<div
							className={cn(
								"absolute transition-all",
								copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
							)}
						>
							<CopyIcon size={16} strokeWidth={2} aria-hidden="true" />
						</div>
					</Button>
				</TooltipTrigger>
				<TooltipContent className="px-2 py-1 text-xs">Click to copy</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function ShareChatModal({
	open,
	onOpenChange,
	chatId,
	isPublic = false,
	onToggle,
}: ShareChatModalProps) {
	const [pending, setPending] = useState(false);
	const [publicState, setPublicState] = useState(isPublic);

	useEffect(() => setPublicState(isPublic), [isPublic]);

	const handleToggle = async () => {
		setPending(true);
		try {
			const next = !publicState;
			await onToggle(next);
			setPublicState(next);
			if (next) {
				const url = `${window.location.origin}/p/${chatId}`;
				await navigator.clipboard.writeText(url);
				toast({ title: "Public link copied", status: "info" });
			} else {
				onOpenChange(false);
			}
		} catch (e) {
			toast({ title: "Failed to update", status: "error" });
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={pending ? () => {} : onOpenChange}>
			<DialogContent className="max-w-md rounded-2xl bg-muted p-0 text-muted-foreground">
				<div className="p-6 pb-2">
					<DialogTitle className="mb-2 font-semibold text-lg text-white">
						Share Chat
					</DialogTitle>
					<div className="mb-4 border-white/10 border-b" />
					<div className="space-y-4 overflow-hidden">
						<p className="text-sm text-white/80">
							{publicState
								? "This chat is currently public. Anyone with the link can view it."
								: "This chat is private. Toggle to generate a public link."}
						</p>
						{publicState && (
							<div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm">
								<span className="truncate flex-1">{`${window.location.origin}/p/${chatId}`}</span>
								<CopyButton text={`${window.location.origin}/p/${chatId}`} />
							</div>
						)}
					</div>
					<div className="mt-6 flex flex-wrap justify-end gap-2">
						<Button
							variant="ghost"
							disabled={pending}
							onClick={() => onOpenChange(false)}
						>
							Close
						</Button>
						<Button onClick={handleToggle} disabled={pending}>
							{publicState ? "Make Private" : "Make Public"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
