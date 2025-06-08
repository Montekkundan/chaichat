import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "~/components/ui/prompt-input";
import { Button } from "~/components/ui/button";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";
import { useRef, useState } from "react";
import { CookiePreferencesModal } from "~/components/modals/cookie-preferences-modal"

export function PromptInputBottom({
  value,
  onValueChange,
  onSubmit,
  isLoading: externalLoading,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (input: string, files: File[]) => void;
  isLoading?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [showCookieModal, setShowCookieModal] = useState(false);

  const handleSubmit = () => {
    if ((value.trim() || files.length > 0) && !isLoading) {
      setIsLoading(true);
      onSubmit(value, files);
      setTimeout(() => {
        setIsLoading(false);
        onValueChange("");
        setFiles([]);
      }, 2000); // Simulate async
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
    <div className="fixed inset-x-0 bottom-0 z-20 w-full bg-secondary/80 backdrop-blur-md p-4 flex justify-center">
      <div className="w-full max-w-xl">
        <PromptInput
          value={value}
          onValueChange={onValueChange}
          isLoading={isLoading || externalLoading}
          onSubmit={handleSubmit}
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {files.map((file, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  key={file.name + file.size + index}
                  className="bg-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                >
                  <Paperclip className="size-4" />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    className="hover:bg-secondary/50 rounded-full p-1"
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
                htmlFor="file-upload-bottom"
                className="hover:bg-secondary-foreground/10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl"
              >
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload-bottom"
                />
                <Paperclip className="text-primary size-5" />
              </label>
            </PromptInputAction>

            <PromptInputAction tooltip={isLoading ? "Stop generation" : "Send message"}>
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
        <div className="h-3" />
        <div className="text-center text-xs text-muted-foreground pb-1 select-none">
          ChaiChat can make mistakes. Check important info. <button type="button" className="underline cursor-pointer" onClick={() => setShowCookieModal(true)}>See Cookie Preferences.</button>
        </div>
        <CookiePreferencesModal open={showCookieModal} onOpenChange={setShowCookieModal} />
      </div>
    </div>
  );
} 