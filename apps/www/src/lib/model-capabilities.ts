import type { LLMGatewayModel } from "~/types/llmgateway";
import { getAllKeys } from "~/lib/local-keys";

// TODO: update this when AI Gateway API provides input/output modalities.
// For AI Gateway models, callers currently bypass capability checks.

// Resolve selected model object from list using id or provider/model form
export function resolveSelectedModel(
  models: LLMGatewayModel[],
  selectedModelId: string,
): { model?: LLMGatewayModel; providerId?: string } {
  if (!selectedModelId) return {};
  if (selectedModelId.includes("/")) {
    const firstSlash = selectedModelId.indexOf("/");
    const provider = selectedModelId.substring(0, firstSlash);
    const modelName = selectedModelId.substring(firstSlash + 1);
    const model = models.find((m) =>
      m.providers?.some(
        (p) =>
          p.providerId === provider &&
          (p.modelName === modelName || p.modelName.endsWith(`/${modelName}`)),
      ),
    );
    return { model, providerId: provider };
  }
  const model = models.find((m) => m.id === selectedModelId || m.name === selectedModelId);
  return { model };
}

// Heuristic vision support for plain `provider/model` ids (works well for Vercel AI Gateway lists)
export function supportsVisionByModelId(modelId: string): boolean {
  try {
    if (!modelId || typeof modelId !== "string") return false;
    const [rawProvider, ...rest] = modelId.split("/");
    const provider = (rawProvider || "").toLowerCase();
    const name = rest.join("/").toLowerCase();

    // OpenAI: known multimodal families. Exclude reasoning-only families.
    if (provider === "openai") {
      const allow =
        /^gpt-4o(\b|[-_])/.test(name) ||
        /^gpt-4\.1(\b|[-_])/.test(name) ||
        /^gpt-4-vision(\b|[-_])/.test(name) ||
        /^omni(\b|[-_])/.test(name) ||
        /^o4(\b|[-_])/.test(name) ||
        /^o-mini(\b|[-_])/.test(name) ||
        /^gpt-4-turbo(\b|[-_])/.test(name);
      const deny = /^o1(\b|[-_])/.test(name) || /^o3(\b|[-_])/.test(name) || /^gpt-5(\b|[-_])/.test(name);
      return allow && !deny;
    }

    // Google: Gemini 1.5 (Pro/Flash) and 2.0 families support images; also "image-preview" variants
    if (provider === "google" || provider === "gemini" || provider === "google-ai-studio" || provider === "google-generative-ai") {
      return /^(gemini-1\.5|gemini-2)/.test(name) || /image-preview/.test(name);
    }

    // Anthropic: Claude 3 and 3.5 families support images.
    if (provider === "anthropic" || provider === "anthropic-claude") {
      return /^claude-3(\b|[-_])/.test(name) || /^claude-3\.5(\b|[-_])/.test(name);
    }

    // Meta: Llama 3.2 Vision family
    if (provider === "meta" || provider === "meta-llama" || provider === "llama" || provider === "meta-llama-ai") {
      return /llama[-_ ]?3\.2.*vision/.test(name) || /-vision/.test(name);
    }

    // xAI Grok 2 vision
    if (provider === "xai" || provider === "x-ai" || provider === "x") {
      return /grok.*vision/.test(name);
    }

    // Fallback: look for common multimodal cues
    return /vision|image|multimodal|image-preview|4o/.test(name);
  } catch {
    return false;
  }
}

export function modelSupportsVision(
  models: LLMGatewayModel[],
  selectedModelId: string,
): boolean {
  const { model, providerId } = resolveSelectedModel(models, selectedModelId);
  if (!model) {
    // For sources without rich metadata (e.g., Vercel AI Gateway), infer from id
    return supportsVisionByModelId(selectedModelId);
  }

  if (providerId) {
    const provider = model.providers?.find((p) => p.providerId === providerId);
    if (provider?.vision) return true;
  }
  if (model.providers?.some((p) => p.vision)) return true;

  const inputs = model.architecture?.input_modalities || [];
  if (Array.isArray(inputs) && inputs.some((m) => String(m).toLowerCase() === "image")) {
    return true;
  }

  const hay = `${model.id} ${model.name} ${(model.providers || [])
    .map((p) => `${p.providerId}/${p.modelName}`)
    .join(" ")}`
    .toLowerCase();
  if (/gpt-4o/.test(hay) || /vision/.test(hay) || /gemini/.test(hay) || /image-preview/.test(hay)) {
    return true;
  }

  // As a last resort, infer by the id alone (helps with Vercel AI Gateway lists)
  return supportsVisionByModelId(selectedModelId);
}

export function getStorageSelection(): {
  provider: "uploadthing" | "vercelblob" | null;
  explicitlySelected: boolean;
} {
  try {
    const raw = window.localStorage.getItem("chai-storage-provider");
    if (raw === "uploadthing" || raw === "vercelblob") {
      return { provider: raw, explicitlySelected: true };
    }
  } catch {}
  return { provider: null, explicitlySelected: false };
}

export function isStorageReady(): { ready: boolean; reason?: string } {
  const { provider, explicitlySelected } = getStorageSelection();
  if (!explicitlySelected || !provider) {
    return { ready: false, reason: "Select a storage provider in Settings" };
  }
  const keys = getAllKeys();
  if (provider === "uploadthing") {
    const ok = Boolean(keys.uploadThingApiKey);
    return ok
      ? { ready: true }
      : { ready: false, reason: "UploadThing API key is missing" };
  }
  if (provider === "vercelblob") {
    const ok = Boolean(keys.vercelBlobApiKey);
    return ok
      ? { ready: true }
      : { ready: false, reason: "Vercel Blob API key is missing" };
  }
  return { ready: false, reason: "Storage not configured" };
}
