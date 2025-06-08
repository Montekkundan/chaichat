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

export function PromptInputCentered({
	value,
	onValueChange,
	onSubmit,
}: {
	value: string;
	onValueChange: (value: string) => void;
	onSubmit: () => void;
}) {
	const [isLoading, setIsLoading] = useState(false);
	const [files, setFiles] = useState<File[]>([]);
	const uploadInputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = () => {
		if (value.trim() || files.length > 0) {
			setIsLoading(true);
			setTimeout(() => {
				setIsLoading(false);
				onValueChange("");
				setFiles([]);
			}, 2000);
			onSubmit();
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

	return (
		<div className="flex min-h-screen w-full items-center justify-center bg-secondary">
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
							{files.map((file, index) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
									key={file.name + file.size + index}
									className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
								>
									<Paperclip className="size-4" />
									<span className="max-w-[120px] truncate">{file.name}</span>
									<button
										type="button"
										onClick={() => handleRemoveFile(index)}
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
								htmlFor="file-upload"
								className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl hover:bg-secondary-foreground/10"
							>
								<input
									type="file"
									multiple
									onChange={handleFileChange}
									className="hidden"
									id="file-upload"
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
			</div>
		</div>
	);
}
