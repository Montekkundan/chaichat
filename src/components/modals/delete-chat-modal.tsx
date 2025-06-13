import { Loader2 } from "lucide-react";
import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "../ui/button";

interface DeleteChatModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCancel: () => void;
	onConfirm: () => Promise<void>;
}

export function DeleteChatModal({
	open,
	onOpenChange,
	onCancel,
	onConfirm,
}: DeleteChatModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);

	const handleConfirm = async () => {
		setIsDeleting(true);
		try {
			await onConfirm();
		} catch (error) {
			console.error("Delete failed:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleCancel = () => {
		if (isDeleting) return;
		onCancel();
	};

	return (
		<Dialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
			<DialogContent className="max-w-md rounded-2xl bg-muted p-0 text-muted-foreground">
				<div className="p-6 pb-2">
					<DialogTitle className="mb-2 font-semibold text-lg text-white">
						Delete Chat
					</DialogTitle>
					<div className="mb-4 border-white/10 border-b" />
					<div className="mb-6 text-sm text-white/80">
						Are you sure you want to delete this chat and all its messages? This
						action cannot be undone.
					</div>
					<div className="flex justify-end gap-2">
						<Button
							variant="ghost"
							onClick={handleCancel}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleConfirm}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								"Delete"
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
