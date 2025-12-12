"use client";

import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextCacheUsage,
} from "~/components/ai-elements/context";
import { useMessages } from "~/lib/providers/messages-provider";
import { useLLMModels } from "~/hooks/use-models";

export function ChatContextIndicator() {
  const { selectedModel, messages } = useMessages();
  // Get models from both sources so we can resolve context/pricing for
  // last-used models regardless of current gateway selection.
  const { models: llmModels } = useLLMModels({ source: "llmgateway", controlled: true });
  const { models: aiModels } = useLLMModels({ source: "aigateway", controlled: true });
  const models = [...llmModels, ...aiModels];

  // Determine the most recent model used in the conversation (prefer assistant)
  const lastUsedModelId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as unknown as { model?: string };
      if (typeof m?.model === "string" && m.model.trim().length > 0) return m.model;
    }
    return undefined;
  })();

  // Prefer the currently selected model for the next turn; fall back to last used
  const effectiveModelId = selectedModel || lastUsedModelId;

  const selectedModelMeta = (() => {
    const id = effectiveModelId;
    if (!id) return undefined;
    if (id.includes("/")) {
      const firstSlash = id.indexOf("/");
      const provider = id.substring(0, firstSlash);
      const modelName = id.substring(firstSlash + 1);
      // exact provider + model match
      const exact = models.find((m) =>
        m.providers?.some(
          (p) => p.providerId === provider && (p.modelName === modelName || p.modelName.endsWith(`/${modelName}`)),
        ),
      );
      if (exact) return exact;
      // fallback: match by model name
      return models.find((m) => m.id === modelName || m.name === modelName);
    }
    return models.find((m) => m.id === id || m.name === id);
  })();

  const maxContextTokens = selectedModelMeta?.context_length ?? 128000;
  const tokenlensModelId = (effectiveModelId ? (effectiveModelId.replace("/", ":") as import("tokenlens").ModelId) : undefined);

  // Very lightweight token estimation: ~4 chars per token
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  const getTextFromParts = (parts: import("@ai-sdk/react").UIMessage["parts"]) => {
    if (!Array.isArray(parts)) return "";
    return parts
      .filter((p) => (p as { type?: string }).type === "text")
      .map((p) => (p as { type: "text"; text: string }).text || "")
      .join("\n");
  };
  const inputChars = messages
    .filter((m) => m.role === "user")
    .map((m) => (m.parts ? getTextFromParts(m.parts) : (m as { content?: string }).content || ""))
    .join("\n");
  const outputChars = messages
    .filter((m) => m.role === "assistant")
    .map((m) => (m.parts ? getTextFromParts(m.parts) : (m as { content?: string }).content || ""))
    .join("\n");
  const inputTokens = estimateTokens(inputChars);
  const outputTokens = estimateTokens(outputChars);
  const usedTokens = inputTokens + outputTokens;
  const usage = {
    inputTokens,
    outputTokens,
    totalTokens: usedTokens,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  } as const;

  return (
    <div className="pointer-events-none absolute top-2 right-2 z-40">
      <div className="pointer-events-auto">
        <Context maxTokens={maxContextTokens} usedTokens={usedTokens} usage={usage} modelId={tokenlensModelId}>
          <ContextTrigger />
          <ContextContent>
            <ContextContentHeader />
            <ContextContentBody>
              <ContextInputUsage />
              <ContextOutputUsage />
              <ContextReasoningUsage />
              <ContextCacheUsage />
            </ContextContentBody>
            <ContextContentFooter />
          </ContextContent>
        </Context>
      </div>
    </div>
  );
}
