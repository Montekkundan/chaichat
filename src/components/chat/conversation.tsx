"use client"

import {
  ChatContainerContent,
  ChatContainerRoot,
} from "~/components/prompt-kit/chat-container"
import { Markdown } from "~/components/prompt-kit/markdown"
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "~/components/prompt-kit/message"
import { ScrollButton } from "~/components/prompt-kit/scroll-button"
import type { MessageListMessage } from "../message-list";
import { useRef } from "react";

interface ConversationProps {
  messages: MessageListMessage[];
  showAvatar?: boolean;
}

export function Conversation({ messages, showAvatar = false }: ConversationProps) {
    const containerRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={containerRef} className="relative mx-auto flex w-full flex-col overflow-y-auto">
      <ChatContainerRoot className="h-full w-full mb-4">
        <ChatContainerContent className="space-y-12 p-4 py-10 max-w-3xl mx-auto pb-50">
          {messages.map((message: MessageListMessage) => {
            const isAssistant = message.role === "assistant"
            const isUser = message.role === "user"
            return (
              <Message
                key={message.id}
                className={isUser ? "justify-end" : "justify-start"}
              >
                {isAssistant && showAvatar && (
                  <MessageAvatar
                    src="/avatars/ai.png"
                    alt="AI Assistant"
                    fallback="AI"
                    className="mr-2 w-8 h-8"
                  />
                )}
                <div className={`${isUser ? "max-w-[60%]" : "max-w-full"}`}>
                  {isAssistant ? (
                    <div className="bg-secondary text-foreground prose rounded-lg p-2">
                      <Markdown>{Array.isArray(message.content) ? message.content.join("") : message.content}</Markdown>
                    </div>
                  ) : (
                    <MessageContent className="bg-primary text-primary-foreground">
                      {Array.isArray(message.content) ? message.content.join("") : message.content}
                    </MessageContent>
                  )}
                </div>
              </Message>
            )
          })}
        </ChatContainerContent>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-40 z-20">
          <ScrollButton className="shadow-sm" />
        </div>
      </ChatContainerRoot>
    </div>
  )
}
