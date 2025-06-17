'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Button } from '../ui/button';
import { toast } from '~/components/ui/toast';

interface ShareChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  isPublic?: boolean;
  onToggle: (newValue: boolean) => Promise<void>;
}

export function ShareChatModal({ open, onOpenChange, chatId, isPublic = false, onToggle }: ShareChatModalProps) {
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
        toast({ title: 'Public link copied', status: 'info' });
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast({ title: 'Failed to update', status: 'error' });
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
          <div className="mb-4 border-b border-white/10" />
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              {publicState
                ? 'This chat is currently public. Anyone with the link can view it.'
                : 'This chat is private. Toggle to generate a public link.'}
            </p>
            {publicState && (
              <div className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm">
                <span className="truncate">{`${window.location.origin}/p/${chatId}`}</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/p/${chatId}`);
                    toast({ title: 'Link copied', status: 'info' });
                  }}
                >
                  Copy
                </Button>
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleToggle} disabled={pending}>
              {publicState ? 'Make Private' : 'Make Public'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 