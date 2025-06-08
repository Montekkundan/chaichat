"use client";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from "~/components/ui/message";
import { Button } from "~/components/ui/button";
import { Copy } from "lucide-react";
import { useState } from "react";

export type MessageListMessage = {
  id: string;
  role: "user" | "assistant";
  content: string | string[];
};

type MessageListProps = {
  messages: MessageListMessage[];
  showAvatar?: boolean;
};

export function MessageList({ messages, showAvatar = false }: MessageListProps) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="flex max-h-[80vh] flex-col gap-8 overflow-y-auto p-4">
        {messages.map((message) => (
          <MessageWithActions
            key={message.id}
            message={message}
            showAvatar={showAvatar}
          />
        ))}
      </div>
    </div>
  );
}

function MessageWithActions({
  message,
  showAvatar,
}: {
  message: MessageListMessage;
  showAvatar: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const content = Array.isArray(message.content)
    ? message.content.join("")
    : message.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (message.role === "user") {
    return (
      <Message className="justify-end">
        <MessageContent>{content}</MessageContent>
      </Message>
    );
  }

  // assistant message
  return (
    <Message className="justify-start">
      {showAvatar && (
        <MessageAvatar src="/avatars/ai.png" alt="AI" fallback="AI" />
      )}
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-row items-end gap-2">
          <div className="flex-1">
            <MessageContent markdown className="bg-transparent p-0">
              {content}
            </MessageContent>
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <MessageActions className="self-start">
            <MessageAction tooltip="Copy to clipboard">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleCopy}
              >
                <Copy className={`size-4 ${copied ? "text-green-500" : ""}`} />
              </Button>
            </MessageAction>
          </MessageActions>
        </div>
      </div>
    </Message>
  );
}
