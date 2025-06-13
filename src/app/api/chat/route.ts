// import { loadAgent } from "@/lib/agents/load-agent"
import { SYSTEM_PROMPT_DEFAULT, FREE_MODELS_IDS } from "~/lib/config"
// import { loadMCPToolsFromURL } from "@/lib/mcp/load-mcp-from-url"
import { getAllModels } from "~/lib/models"
import { getProviderForModel } from "~/lib/openproviders/provider-map"
import { openproviders } from "~/lib/openproviders"
// import { Provider } from "@/lib/user-keys"
import type { Attachment } from "@ai-sdk/ui-utils"
import { type Message as MessageAISDK, streamText, type ToolSet } from "ai"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
// import {
//   logUserMessage,
//   storeAssistantMessage,
//   trackSpecialAgentUsage,
//   validateAndTrackUsage,
// } from "./api"
import { cleanMessagesForTools } from "./utils"

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  agentId?: string
  regenerateMessageId?: string 
  temperature?: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      agentId,
      regenerateMessageId,
      temperature,
    } = body as ChatRequest

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    // Initialize Convex client for server-side queries
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }
    const convex = new ConvexHttpClient(convexUrl);

    // Check if this is a free model or requires user API key
    const isFreeModel = FREE_MODELS_IDS.includes(model);
    let userApiKeys: Record<string, string | undefined> = {};

    if (!isFreeModel && isAuthenticated) {
      // Get user's API keys for premium models
      try {
        userApiKeys = await convex.query(api.userKeys.getUserKeysForAPI, { userId });
      } catch (error) {
        console.error("Failed to fetch user API keys:", error);
      }
    }

    // const supabase = await validateAndTrackUsage({
    //   userId,
    //   model,
    //   isAuthenticated,
    // })

    // const userMessage = messages[messages.length - 1]

    // if (supabase && userMessage?.role === "user") {
    //   await logUserMessage({
    //     supabase,
    //     userId,
    //     chatId,
    //     content: userMessage.content,
    //     attachments: userMessage.experimental_attachments as Attachment[],
    //     model,
    //     isAuthenticated,
    //   })
    // }

    // let agentConfig = null

    // if (agentId) {
    //   agentConfig = await loadAgent(agentId)
    // }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    const effectiveSystemPrompt =
      // agentConfig?.systemPrompt || 
      systemPrompt || SYSTEM_PROMPT_DEFAULT

    // let toolsToUse = undefined

    // if (agentConfig?.mcpConfig) {
    //   const { tools } = await loadMCPToolsFromURL(agentConfig.mcpConfig.server)
    //   toolsToUse = tools
    // } else if (agentConfig?.tools) {
      // toolsToUse = agentConfig.tools
      // if (supabase) {
      //   await trackSpecialAgentUsage(supabase, userId)
      // }
    // }

    // Clean messages when switching between agents with different tool capabilities
    // const hasTools = !!toolsToUse && Object.keys(toolsToUse).length > 0
    // const cleanedMessages = cleanMessagesForTools(messages, hasTools)

    let streamError: Error | null = null

    // Determine which API key to use
    let apiKey: string | undefined;
    
    if (isFreeModel) {
      // Use project API key for free models
      apiKey = undefined; // This will use default project keys from openproviders
    } else {
      // Use user's API key for premium models
      const provider = getProviderForModel(model);
      const userKey = userApiKeys[`${provider}Key`];
      
      if (!userKey) {
        return new Response(
          JSON.stringify({ 
            error: `This model requires your own ${provider.toUpperCase()} API key. Please add it in Settings.`,
            code: "API_KEY_REQUIRED" 
          }),
          { status: 403 }
        );
      }
      
      apiKey = userKey;
    }

    // Get the model instance with the appropriate API key
    const modelInstance = isFreeModel 
      ? modelConfig.apiSdk(undefined)
      : modelConfig.apiSdk(apiKey);

    const result = streamText({
      model: modelInstance,
      system: effectiveSystemPrompt,
      messages: messages,
      // tools: toolsToUse as ToolSet,
      maxSteps: 10,
      temperature: temperature || 0.8,
      onError: (err: unknown) => {
        console.error("🛑 streamText error:", err)
        streamError = new Error(
          (err as { error?: string })?.error ||
            "AI generation failed. Please check your model or API key."
        )
      },

      onFinish: async ({ response }) => {
        // if (supabase) {
        //   await storeAssistantMessage({
        //     supabase,
        //     chatId,
        //     messages:
        //       response.messages as unknown as import("@/app/types/api.types").Message[],
        //   })
        // }
      },
    })

    if (streamError) {
      throw streamError
    }

    const originalResponse = result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
    })
    const headers = new Headers(originalResponse.headers)
    headers.set("X-Chat-Id", chatId)

    return new Response(originalResponse.body, {
      status: originalResponse.status,
      headers,
    })
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    // Return a structured error response if the error is a UsageLimitError.
    const error = err as { code?: string; message?: string }
    if (error.code === "DAILY_LIMIT_REACHED") {
      return new Response(
        JSON.stringify({ error: error.message, code: error.code }),
        { status: 403 }
      )
    }

    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500 }
    )
  }
}
