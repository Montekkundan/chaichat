let modelsDataCache: any = null;
let providerMetadataCache: Map<string, any> = new Map();

function clearCache() {
  modelsDataCache = null;
  providerMetadataCache.clear();
}

async function loadModelsData(): Promise<any> {
  if (modelsDataCache) {
    return modelsDataCache;
  }

  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/models.json');
      if (response.ok) {
        const data = await response.json();
        const { filterModelsJsonByTested } = await import('../models/tested-providers');
        modelsDataCache = filterModelsJsonByTested(data);
        return modelsDataCache;
      }
    } catch (error) {
      console.warn('Failed to load models.json:', error);
    }
  } else {
    const fs = require('fs');
    const path = require('path');
    const modelsPath = path.join(process.cwd(), 'public', 'models.json');
    
    if (fs.existsSync(modelsPath)) {
      const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
      const { filterModelsJsonByTested } = await import('../models/tested-providers');
      modelsDataCache = filterModelsJsonByTested(data);
      return modelsDataCache;
    }
  }
  return null;
}

async function getProviderMetadata(providerName: string): Promise<any> {
  if (providerMetadataCache.has(providerName)) {
    return providerMetadataCache.get(providerName);
  }

  try {
    const modelsData = await loadModelsData();
    if (modelsData?.providers && modelsData.providers[providerName]) {
      const metadata = modelsData.providers[providerName];
      providerMetadataCache.set(providerName, metadata);
      return metadata;
    }
  } catch (error) {
    console.warn('Failed to get provider metadata:', error);
  }
  
  return null;
}

async function getProviderFromModelId(modelId: string): Promise<{ id: string; metadata: any } | null> {
  try {
    const modelsData = await loadModelsData();
    if (!modelsData?.models) {
      return null;
    }
    
    const model = modelsData.models.find((m: any) => m.id === modelId);
    if (model?.provider) {
      const metadata = await getProviderMetadata(model.provider);
      
      const providerId = model.provider
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
        
      return {
        id: providerId,
        metadata
      };
    }
  } catch (error) {
    console.warn('Failed to get provider from models.json:', error);
  }
  
  return null;
}

async function createProviderFromNpm(npmPackage: string, apiKey?: string, metadata?: any, providerOptions?: any): Promise<any> {
  try {
    if (npmPackage === "@ai-sdk/openai-compatible") {
      const { createOpenAI } = await import("@ai-sdk/openai");
      if (!apiKey) {
        throw new Error("API key required for OpenAI-compatible providers");
      }
      return createOpenAI({ apiKey });
    }
    
    const { isServerOnlyProvider } = await import('./provider-constants');
    if (isServerOnlyProvider(npmPackage)) {
      if (typeof window !== 'undefined') {
        throw new Error(`${npmPackage} is only available on the server-side`);
      }
      const { getServerProvider } = await import('./server-providers');
      return getServerProvider(npmPackage, apiKey, metadata, providerOptions);
    }
    
    let providerModule;
    try {
      switch (npmPackage) {
        case "@ai-sdk/openai":
          providerModule = await import(/* webpackChunkName: "ai-sdk-openai" */ "@ai-sdk/openai");
          break;
        case "@ai-sdk/anthropic":
          providerModule = await import(/* webpackChunkName: "ai-sdk-anthropic" */ "@ai-sdk/anthropic");
          break;
        case "@ai-sdk/google":
          providerModule = await import(/* webpackChunkName: "ai-sdk-google" */ "@ai-sdk/google");
          break;
        case "@ai-sdk/mistral":
          providerModule = await import(/* webpackChunkName: "ai-sdk-mistral" */ "@ai-sdk/mistral");
          break;
        case "@ai-sdk/xai":
          providerModule = await import(/* webpackChunkName: "ai-sdk-xai" */ "@ai-sdk/xai");
          break;
        case "@ai-sdk/groq":
          providerModule = await import(/* webpackChunkName: "ai-sdk-groq" */ "@ai-sdk/groq");
          break;
        case "@ai-sdk/togetherai":
          providerModule = await import(/* webpackChunkName: "ai-sdk-togetherai" */ "@ai-sdk/togetherai");
          break;
        case "@ai-sdk/deepinfra":
          providerModule = await import(/* webpackChunkName: "ai-sdk-deepinfra" */ "@ai-sdk/deepinfra");
          break;
        case "@ai-sdk/azure":
          providerModule = await import(/* webpackChunkName: "ai-sdk-azure" */ "@ai-sdk/azure");
          break;
        case "@ai-sdk/gateway":
          providerModule = await import(/* webpackChunkName: "ai-sdk-gateway" */ "@ai-sdk/gateway");
          break;
        case "@ai-sdk/vercel":
          providerModule = await import(/* webpackChunkName: "ai-sdk-vercel" */ "@ai-sdk/vercel");
          break;
        case "@requesty/ai-sdk":
          providerModule = await import(/* webpackChunkName: "requesty-ai-sdk" */ "@requesty/ai-sdk");
          break;
        default:
          throw new Error(`Package ${npmPackage} is not supported. Please add it to the dynamic import list.`);
      }
    } catch (importError) {
      throw new Error(`Package ${npmPackage} is not installed. Please install it with: npm install ${npmPackage}`);
    }
    
    let createFunction = null;
    let defaultInstance = null;
    
    for (const [key, value] of Object.entries(providerModule)) {
      if (typeof value === 'function') {
        if (key.startsWith('create') && key.length > 6) {
          createFunction = value;
        } else if (!key.startsWith('create') && !key.startsWith('_') && key.length < 15) {
          defaultInstance = value;
        }
      }
    }
    
    if (createFunction && apiKey) {
      const config = { apiKey, ...providerOptions };
      return createFunction(config);
    }
    
    if (defaultInstance) {
      return defaultInstance;
    }
    
    throw new Error(`Could not find suitable provider factory in ${npmPackage}. Available exports: ${Object.keys(providerModule).join(', ')}`);
    
  } catch (error) {
    throw new Error(`Failed to import provider ${npmPackage}: ${error}`);
  }
}

function getBaseURLFromMetadata(metadata: any): string | null {
  if (metadata?.baseURL) return metadata.baseURL;
  if (metadata?.url) return metadata.url;
  if (metadata?.endpoint) return metadata.endpoint;
  
  if (metadata?.env) {
    for (const [key, value] of Object.entries(metadata.env)) {
      if (typeof value === 'string' && (
        key.toLowerCase().includes('url') || 
        key.toLowerCase().includes('endpoint') ||
        key.toLowerCase().includes('base')
      )) {
        return value;
      }
    }
  }
  
  return null;
}

export async function createDynamicProvider(
  modelId: string,
  apiKey?: string,
  providerOptions?: any
): Promise<any> {
  const providerInfo = await getProviderFromModelId(modelId);
  
  if (!providerInfo) {
    throw new Error(`Could not determine provider for model: ${modelId}`);
  }
  
  const { id: providerId, metadata } = providerInfo;
  const npmPackage = metadata?.npm;
  
  if (!npmPackage) {
    throw new Error(`No npm package specified for provider: ${providerId}`);
  }

  if (npmPackage === "@ai-sdk/openai-compatible") {
    if (!apiKey) {
      throw new Error(`API key required for OpenAI-compatible provider: ${providerId}`);
    }

    const baseURL = getBaseURLFromMetadata(metadata);
    if (!baseURL) {
      throw new Error(`No base URL found for OpenAI-compatible provider: ${providerId}`);
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    
    const transformedModelId = modelId;
    
    const provider = createOpenAI({
      baseURL: baseURL,
      apiKey: providerId === "ollama" ? "ollama" : apiKey,
      name: providerId,
    });
    
    return provider(transformedModelId as any);
  }

  const { isServerOnlyProvider } = await import('./provider-constants');
  if (isServerOnlyProvider(npmPackage)) {
    if (typeof window !== 'undefined') {
      throw new Error(`${npmPackage} models are only available on the server-side. Provider: ${providerId}, Model: ${modelId}`);
    }
    const { getServerProvider } = await import('./server-providers');
    const provider = await getServerProvider(npmPackage, apiKey, metadata, providerOptions);
    return provider(modelId as any);
  }

  const provider = await createProviderFromNpm(npmPackage, apiKey, metadata, providerOptions);
  return provider(modelId as any);
}

export async function getSupportedProviders(): Promise<string[]> {
  try {
    const modelsData = await loadModelsData();
    if (!modelsData?.models) {
      return [];
    }
    
    const providers = new Set<string>();
    for (const model of modelsData.models) {
      if (model.provider) {
        const providerId = model.provider
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        providers.add(providerId);
      }
    }
    
    return Array.from(providers).sort();
  } catch (error) {
    console.warn('Failed to get supported providers:', error);
    return [];
  }
}

export async function isModelSupported(modelId: string): Promise<boolean> {
  try {
    const providerId = await getProviderFromModelId(modelId);
    return providerId !== null;
  } catch (error) {
    console.warn('Failed to check model support:', error);
    return false;
  }
}

export function clearModelsCache(): void {
  clearCache();
}
