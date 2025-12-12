import type { ModelMessage } from "ai";
import { combineTextFromUIMessages, removeEmptyModelMessages } from "./utils";
import type { UIMessage } from "ai";

export type PromptPayload =
  | { kind: "google"; system?: string; messages: ModelMessage[] }
  | { kind: "oai-reasoning"; system?: string; prompt: string }
  | { kind: "chat"; system?: string; messages: ModelMessage[] };

export function buildPromptPayload(params: {
  isGoogle: boolean;
  isOAIReasoning: boolean;
  modelId: string;
  uiMessages: UIMessage[];
  convertedMessages: ModelMessage[];
  system?: string;
  bodyInput?: string;
}): PromptPayload {
  const { isGoogle, isOAIReasoning, uiMessages, convertedMessages, system, bodyInput } = params;

  if (isGoogle) {
    const combined = combineTextFromUIMessages(uiMessages);
    const prompt = combined && combined.trim().length > 0 ? combined : bodyInput ?? "";
    // For Google we pass a single user text to avoid modality confusion
    const googleMessages = [
      { role: "user" as const, content: prompt && prompt.length > 0 ? prompt : "" },
    ];
    return { kind: "google", system, messages: googleMessages as unknown as ModelMessage[] };
  }

  if (isOAIReasoning) {
    // For OpenAI reasoning (Responses API under the hood), provide a single prompt string
    const combined = combineTextFromUIMessages(uiMessages);
    const prompt = combined && combined.trim().length > 0 ? combined : bodyInput ?? "";
    return { kind: "oai-reasoning", system, prompt };
  }

  return {
    kind: "chat",
    system,
    messages: removeEmptyModelMessages<ModelMessage>(convertedMessages),
  };
}
