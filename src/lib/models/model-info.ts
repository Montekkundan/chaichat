import modelsData from '../../../public/models.json';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  pricing?: {
    input?: number;
    output?: number;
    unit?: string;
  };
  context_window?: number;
  capabilities?: {
    vision?: boolean;
    tools?: boolean;
    audio?: boolean;
    reasoningText?: boolean;
  };
  released_at?: string;
  description?: string;
  open_source?: boolean;
  apiDocs?: string;
}

export function getModelInfo(modelId: string): ModelInfo | null {
  if (!modelId) return null;
  
  try {
    const model = modelsData.models.find((m: any) => m.id === modelId);
    return model || null;
  } catch (error) {
    console.warn('Failed to get model info:', error);
    return null;
  }
}

export function getModelDisplayName(modelId: string): string {
  const modelInfo = getModelInfo(modelId);
  if (!modelInfo) {
    // Fallback to a cleaned up version of the model ID
    return modelId.split('/').pop() || modelId;
  }
  
  return modelInfo.name;
}

export function getProviderDisplayName(modelId: string): string {
  const modelInfo = getModelInfo(modelId);
  if (!modelInfo) {
    return 'Unknown Provider';
  }
  
  return modelInfo.provider;
}

export function formatModelAndProvider(modelId: string): string {
  const modelInfo = getModelInfo(modelId);
  if (!modelInfo) {
    return modelId;
  }
  
  return `${modelInfo.name} · ${modelInfo.provider}`;
}
