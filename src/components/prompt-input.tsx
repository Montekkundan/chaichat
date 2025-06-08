"use client";

import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	PromptInput,
	PromptInputAction,
	PromptInputActions,
	PromptInputTextarea,
} from "~/components/ui/prompt-input";
import { CookiePreferencesModal } from "~/components/modals/cookie-preferences-modal";

export function PromptInputBox({
	value,
	onValueChange,
	onSubmit,
	isLoading,
	position = "centered",
}: {
	value: string;
	onValueChange: (value: string) => void;
	onSubmit: (input: string, files: File[]) => void;
	isLoading?: boolean;
	position?: "centered" | "bottom";
}) {
	const [files, setFiles] = useState<File[]>([]);
	const uploadInputRef = useRef<HTMLInputElement>(null);
	const [showCookieModal, setShowCookieModal] = useState(false);

	const handleSubmit = () => {
		if (value.trim() || files.length > 0) {
			onSubmit(value, files);
			onValueChange("");
			setFiles([]);
		}
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files) {
			const newFiles = Array.from(event.target.files);
			setFiles((prev) => [...prev, ...newFiles]);
		}
	};

	const handleRemoveFile = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
		if (uploadInputRef?.current) {
			uploadInputRef.current.value = "";
		}
	};

	const mainContent = (
		<div className="w-full max-w-xl">
			<PromptInput
				value={value}
				onValueChange={onValueChange}
				isLoading={isLoading}
				onSubmit={handleSubmit}
				className="w-full"
			>
				{files.length > 0 && (
					<div className="flex flex-wrap gap-2 pb-2">
						{files.map((file) => (
							<div
								key={file.name + file.size + (file.lastModified ?? "")}
								className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
							>
								<Paperclip className="size-4" />
								<span className="max-w-[120px] truncate">{file.name}</span>
								<button
									type="button"
									onClick={() => handleRemoveFile(files.indexOf(file))}
									className="rounded-full p-1 hover:bg-secondary/50"
								>
									<X className="size-4" />
								</button>
							</div>
						))}
					</div>
				)}

				<PromptInputTextarea placeholder="Ask me anything..." />

				<PromptInputActions className="flex items-center justify-between gap-2 pt-2">
					<PromptInputAction tooltip="Attach files">
						<label
							htmlFor={position === "bottom" ? "file-upload-bottom" : "file-upload"}
							className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl hover:bg-secondary-foreground/10"
						>
							<input
								type="file"
								multiple
								onChange={handleFileChange}
								className="hidden"
								id={position === "bottom" ? "file-upload-bottom" : "file-upload"}
								ref={uploadInputRef}
							/>
							<Paperclip className="size-5 text-primary" />
						</label>
					</PromptInputAction>

					<PromptInputAction
						tooltip={isLoading ? "Stop generation" : "Send message"}
					>
						<Button
							variant="default"
							size="icon"
							className="h-8 w-8 rounded-full"
							onClick={handleSubmit}
							disabled={isLoading}
						>
							{isLoading ? (
								<Square className="size-5 fill-current" />
							) : (
								<ArrowUp className="size-5" />
							)}
						</Button>
					</PromptInputAction>
				</PromptInputActions>
			</PromptInput>
			{position === "bottom" && (
				<>
					<div className="h-3" />
					<div className="select-none pb-1 text-center text-muted-foreground text-xs">
						ChaiChat can make mistakes. Check important info.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							onClick={() => setShowCookieModal(true)}
						>
							See Cookie Preferences.
						</button>
					</div>
					<CookiePreferencesModal
						open={showCookieModal}
						onOpenChange={setShowCookieModal}
					/>
				</>
			)}
		</div>
	);

	if (position === "bottom") {
		return (
			<div className="fixed inset-x-0 bottom-0 z-20 flex w-full justify-center bg-secondary/80 p-4 backdrop-blur-md">
				{mainContent}
			</div>
		);
	}
	return mainContent;
}
