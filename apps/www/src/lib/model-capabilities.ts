import type { LLMGatewayModel } from "~/types/llmgateway";
import { getAllKeys } from "~/lib/local-keys";

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

export function modelSupportsVision(
  models: LLMGatewayModel[],
  selectedModelId: string,
): boolean {
  const { model, providerId } = resolveSelectedModel(models, selectedModelId);
  if (!model) return false;

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

  return false;
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

