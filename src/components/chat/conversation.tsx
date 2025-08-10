import type { UIMessage as MessageType } from "@ai-sdk/react";
import { useMemo, useRef } from "react";
import {
  Conversation as AIConversation,
  ConversationContent,
  ConversationScrollButton,
} from "~/components/ai-elements/conversation";
import { Message as AIMessage, MessageContent as AIMessageContent } from "~/components/ai-elements/message";
import { Response } from "~/components/ai-elements/response";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "~/components/ai-elements/reasoning";
import { Actions, Action } from "~/components/ai-elements/actions";
import { Loader } from "~/components/ai-elements/loader";
import { CopyIcon } from "lucide-react";

type ConversationProps = {
	messages: (MessageType & { model?: string; convexId?: string; content?: string })[];
	status?: "streaming" | "ready" | "submitted" | "error";
	onDelete: (id: string) => void;
	onEdit: (id: string, newText: string) => void;
	onReload: () => void;
	onBranch?: (messageIndex: number) => void;
    scrollButtonBottomClass?: string;
};

const getTextContent = (parts: MessageType["parts"], fallbackContent?: string) => {
	if (!parts || !Array.isArray(parts)) {
		// If parts is not available, try to use fallback content
		return fallbackContent || "";
	}
	const textParts = parts.filter((part) => part.type === "text");
	return textParts.map((part) => part.type === "text" ? part.text : "").join("");
};

function getModelDisplay(modelId?: string): {
  provider?: string;
  name?: string;
  display: string;
  tooltip: string;
} {
  if (!modelId) return { display: "Unknown model", tooltip: "Unknown model" };
  if (modelId.includes("/")) {
    const firstSlash = modelId.indexOf("/");
    const provider = modelId.slice(0, firstSlash);
    const name = modelId.slice(firstSlash + 1);
    const shortName = name.split("/").pop() || name;
    return {
      provider,
      name,
      display: shortName,
      tooltip: `Provider: ${provider}\nModel: ${name}`,
    };
  }
  return { display: modelId, tooltip: `Model: ${modelId}` };
}

export function Conversation({
	messages,
	status = "ready",
    onDelete: _onDelete,
    onEdit: _onEdit,
    onReload: _onReload,
    onBranch: _onBranch,
    scrollButtonBottomClass = "bottom-34",
}: ConversationProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const initialMessageCount = useRef(messages.length);

	if (status === "ready" && messages.length > initialMessageCount.current) {
		initialMessageCount.current = messages.length;
	}

  const sortedMessages = useMemo(() => {
    const filtered = messages.filter((m) => {
      if (!["user", "assistant", "system"].includes(m.role)) return false;
      // biome-ignore lint/suspicious/noExplicitAny: runtime field
      return (m as any).isActive !== false;
    });
    return filtered.sort((a, b) => {
      const aTime = (
        "_creationTime" in a
          ? a._creationTime
          : "createdAt" in a
            ? a.createdAt
            : Date.now()
      ) as number;
      const bTime = (
        "_creationTime" in b
          ? b._creationTime
          : "createdAt" in b
            ? b.createdAt
            : Date.now()
      ) as number;
      return aTime - bTime;
    });
  }, [messages]);

	if (!sortedMessages || sortedMessages.length === 0)
		return <div className="h-full w-full" />;

    return (
        <div ref={containerRef} className="relative flex h-full w-full flex-col">
            <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
                <div className="flex h-app-header w-full bg-background lg:hidden lg:h-0" />
                <div className="mask-b-from-4% mask-b-to-100% flex h-app-header w-full bg-background lg:hidden" />
            </div>

            <AIConversation className="relative h-full w-full overflow-y-hidden">
                <ConversationContent className="flex flex-col items-center pb-40 pt-20 w-full">
                    {sortedMessages?.map((message, index) => {
                        const isLast = index === sortedMessages.length - 1 && status !== "submitted";
                        const hasScrollAnchor = isLast && sortedMessages.length > initialMessageCount.current;

                        const textContent = getTextContent(message.parts, message.content || "");
                        const isAssistant = message.role === "assistant";
                        const _isUser = message.role === "user";

                        // Build reasoning/text rendering
                        const parts = message.parts || [];
                        const textParts = parts.filter((p) => p.type === "text") as Array<{ type: "text"; text: string }>;
                        const reasoningParts = parts.filter((p) => p.type === "reasoning") as Array<{ type: "reasoning"; text?: string }>;

                        const combinedText = textParts.map((p) => p.text).join("") || textContent;
                        const thinkRegex = /<think>[\s\S]*?<\/think>/gi;
                        const thinkMatches = combinedText.match(thinkRegex) || [];
                        const stepsFromThinkTags = thinkMatches
                          .map((segment) => segment.replace(/<\/?think>/gi, "").trim())
                          .filter((t) => t.length > 0);
                        const cleanedText = combinedText.replace(thinkRegex, "").trim();

                        const hasReasoning = (reasoningParts?.length ?? 0) > 0 || stepsFromThinkTags.length > 0;
                        const hasRenderableContent = Boolean(cleanedText) || hasReasoning;
                        
                        if (message.role === "assistant" && !hasRenderableContent) {
                            return null;
                        }

                        return (
                            <div
                                key={message.id}
                                className={`group flex w-full max-w-3xl flex-col px-6 pb-2 ${hasScrollAnchor ? "min-h-scroll-anchor" : ""}`}
                            >
                                <AIMessage from={message.role}>
                                    <AIMessageContent className="group-[.is-assistant]:bg-transparent group-[.is-assistant]:p-0 group-[.is-user]:bg-secondary group-[.is-user]:rounded-3xl group-[.is-user]:text-foreground">
                                        {hasReasoning && (
                                            <Reasoning
                                                className="w-full"
                                                isStreaming={status === "streaming" && isLast}
                                            >
                                                <ReasoningTrigger />
                                                <ReasoningContent>
                                                    {[
                                                        ...reasoningParts.map((rp) => rp.text || ""),
                                                        ...stepsFromThinkTags,
                                                    ].join("\n\n")}
                                                </ReasoningContent>
                                            </Reasoning>
                                        )}
                                        {cleanedText && <Response>{cleanedText}</Response>}
                                        {isAssistant && hasRenderableContent && (
                                            <Actions className="group-hover:opacity-100 mt-2 opacity-0 transition-opacity">
                                                {(() => {
                                                  const { provider, display, tooltip } = getModelDisplay(
                                                    // biome-ignore lint/suspicious/noExplicitAny: UIMessage extension carries model optionally
                                                    (message as any).model as string | undefined,
                                                  );
                                                  return (
                                                    <Action
                                                      tooltip={tooltip}
                                                      label="Model"
                                                      variant="ghost"
                                                      size="sm"
                                                      type="button"
                                                    >
                                                      <span className="max-w-[10rem] truncate text-xs">
                                                        {provider && (
                                                          <span className="text-muted-foreground">{provider}/</span>
                                                        )}
                                                        <span className="font-medium">{display}</span>
                                                      </span>
                                                    </Action>
                                                  );
                                                })()}
                                                <Action
                                                    onClick={() => navigator.clipboard.writeText(textContent)}
                                                    label="Copy"
                                                    tooltip="Copy"
                                                >
                                                    <CopyIcon className="size-3" />
                                                </Action>
                                            </Actions>
                                        )}
                                    </AIMessageContent>
                                </AIMessage>
                            </div>
                        );
                    })}

                    {(status === "submitted" || status === "streaming") &&
                        (sortedMessages.length === 0 ||
                            (sortedMessages.length > 0 &&
                                sortedMessages[sortedMessages.length - 1]?.role === "user")) && (
                            <div className="group flex min-h-scroll-anchor w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
                                <Loader />
                            </div>
                        )}
                </ConversationContent>
                <ConversationScrollButton className={`shadow-sm ${scrollButtonBottomClass}`} />
            </AIConversation>
        </div>
    );
}
