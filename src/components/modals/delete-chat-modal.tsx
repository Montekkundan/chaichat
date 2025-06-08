import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Button } from "../ui/button";
import React from "react";

interface DeleteChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteChatModal({ open, onOpenChange, onCancel, onConfirm }: DeleteChatModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-muted p-0 text-muted-foreground">
        <div className="p-6 pb-2">
          <DialogTitle className="mb-2 font-semibold text-lg text-white">
            Delete Chat
          </DialogTitle>
          <div className="mb-4 border-white/10 border-b" />
          <div className="mb-6 text-sm text-white/80">
            Are you sure you want to delete this chat and all its messages?
            This action cannot be undone.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 