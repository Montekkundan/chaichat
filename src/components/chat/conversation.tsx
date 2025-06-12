import {
  ChatContainerContent,
  ChatContainerRoot,
} from "~/components/prompt-kit/chat-container"
import { Loader } from "~/components/prompt-kit/loader"
import { ScrollButton } from "~/components/prompt-kit/scroll-button"
import type { Message as MessageType } from "@ai-sdk/react"

type MessageWithModel = MessageType & { model?: string }
import { useRef } from "react"
import { Message } from "./message"

type ConversationProps = {
  messages: MessageWithModel[]
  status?: "streaming" | "ready" | "submitted" | "error"
  onDelete: (id: string) => void
  onEdit: (id: string, newText: string) => void
  onReload: () => void
  onRegenerate?: (messageIndex: number, model: string) => void
}

export function Conversation({
  messages,
  status = "ready",
  onDelete,
  onEdit,
  onReload,
  onRegenerate,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length)

  // Sort messages by timestamp as a safety measure to ensure correct order
  const sortedMessages = messages.sort((a, b) => {
    // Use createdAt if available, otherwise fall back to a timestamp from the id or current time
    const aTime = ('_creationTime' in a ? a._creationTime : ('createdAt' in a ? a.createdAt : Date.now())) as number;
    const bTime = ('_creationTime' in b ? b._creationTime : ('createdAt' in b ? b.createdAt : Date.now())) as number;
    return aTime - bTime;
  });

  if (!sortedMessages || sortedMessages.length === 0)
    return <div className="h-full w-full" />

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-x-hidden overflow-y-auto">
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
        <div className="h-app-header bg-background flex w-full lg:hidden lg:h-0" />
        <div className="h-app-header bg-background flex w-full mask-b-from-4% mask-b-to-100% lg:hidden" />
      </div>
      <ChatContainerRoot className="relative w-full">
        <ChatContainerContent
          className="flex w-full flex-col items-center pt-20 pb-4"
          style={{
            scrollbarGutter: "stable both-edges",
            scrollbarWidth: "none",
          }}
        >
          {sortedMessages?.map((message, index) => {
            const isLast =
              index === sortedMessages.length - 1 && status !== "submitted"
            const hasScrollAnchor =
              isLast && sortedMessages.length > initialMessageCount.current

            return (
              <Message
                key={message.id}
                id={message.id}
                message={message}
                variant={message.role}
                attachments={message.experimental_attachments}
                isLast={isLast}
                onDelete={onDelete}
                onEdit={onEdit}
                onReload={onReload}
                onRegenerate={onRegenerate ? (model: string) => onRegenerate(index, model) : undefined}
                hasScrollAnchor={hasScrollAnchor}
                parts={message.parts}
                status={status}
                model={message.model}
              >
                {message.content}
              </Message>
            )
          })}
          {(status === "submitted" || status === "streaming") &&
            (sortedMessages.length === 0 || 
             (sortedMessages.length > 0 && sortedMessages[sortedMessages.length - 1]?.role === "user")) && (
              <div className="group min-h-scroll-anchor flex w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
                <Loader />
              </div>
            )}
          <div className="absolute bottom-0 flex w-full max-w-3xl flex-1 items-end justify-end gap-4 px-6 pb-2">
            <ScrollButton className="absolute top-[-50px] right-[30px]" />
          </div>
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  )
}
