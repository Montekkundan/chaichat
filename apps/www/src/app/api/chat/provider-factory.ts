import { createGateway as createVercelGateway } from "@ai-sdk/gateway";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";

export function makeProviders(opts: { llmApiKey?: string; aiGatewayApiKey?: string }) {
  const llmGatewayProvider = createLLMGateway({
    apiKey: opts.llmApiKey ?? "",
    compatibility: "strict",
  });
  const vercelGatewayProvider = createVercelGateway({
    apiKey: opts.aiGatewayApiKey ?? "",
  });
  return { llmGatewayProvider, vercelGatewayProvider };
}

export function getBaseModel(params: {
  usedGateway: "llm-gateway" | "vercel-ai-gateway";
  modelId: string;
  isOAIReasoning: boolean;
  llmGatewayProvider: ReturnType<typeof createLLMGateway>;
  vercelGatewayProvider: ReturnType<typeof createVercelGateway>;
  reasoningEffort?: "low" | "medium" | "high";
}) {
  const { usedGateway, modelId, isOAIReasoning, llmGatewayProvider, vercelGatewayProvider, reasoningEffort } = params;
  if (usedGateway === "vercel-ai-gateway") return vercelGatewayProvider(modelId);
  if (isOAIReasoning) {
    return llmGatewayProvider(modelId, {
      includeReasoning: true,
      reasoning: { effort: reasoningEffort ?? "medium" },
    });
  }
  return llmGatewayProvider(modelId);
}

