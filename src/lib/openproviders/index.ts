// TODO: cleanup

/**
 * Cache for models data and provider metadata
 */
let modelsDataCache: any = null;
let providerMetadataCache: Map<string, any> = new Map();

/**
 * Load models data from models.json
 */
async function loadModelsData(): Promise<any> {
  if (modelsDataCache) {
    return modelsDataCache;
  }

  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/models.json');
      if (response.ok) {
        modelsDataCache = await response.json();
        return modelsDataCache;
      }
    } catch (error) {
      console.warn('Failed to load models.json:', error);
    }
  } else {
    // Server-side
    const fs = require('fs');
    const path = require('path');
    const modelsPath = path.join(process.cwd(), 'public', 'models.json');
    
    if (fs.existsSync(modelsPath)) {
      modelsDataCache = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
      return modelsDataCache;
    }
  }
  return null;
}

/**
 * Get provider metadata for a given provider name
 */
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

/**
 * Get provider ID and metadata from model ID using models.json
 */
async function getProviderFromModelId(modelId: string): Promise<{ id: string; metadata: any } | null> {
  try {
    const modelsData = await loadModelsData();
    if (!modelsData?.models) {
      return null;
    }
    
    const model = modelsData.models.find((m: any) => m.id === modelId);
    if (model?.provider) {
      const metadata = await getProviderMetadata(model.provider);
      
      // Normalize provider name to ID
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

/**
 * Dynamically import and create AI SDK provider instance
 */
async function createProviderFromNpm(npmPackage: string, apiKey?: string, metadata?: any, providerOptions?: any): Promise<any> {
  try {
    // Handle @ai-sdk/openai-compatible specially as it doesn't exist as a standalone package
    if (npmPackage === "@ai-sdk/openai-compatible") {
      const { createOpenAI } = await import("@ai-sdk/openai");
      if (!apiKey) {
        throw new Error("API key required for OpenAI-compatible providers");
      }
      return createOpenAI({ apiKey });
    }
    
    // Check if this is a server-only provider
    const { isServerOnlyProvider } = await import('./provider-constants');
    if (isServerOnlyProvider(npmPackage)) {
      if (typeof window !== 'undefined') {
        throw new Error(`${npmPackage} is only available on the server-side`);
      }
      const { getServerProvider } = await import('./server-providers');
      return getServerProvider(npmPackage, apiKey, metadata, providerOptions);
    }
    
    // Use explicit dynamic imports for known client-safe packages to help webpack
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
    
    // Try to find the appropriate create function and default instance
    let createFunction = null;
    let defaultInstance = null;
    
    // Look for common patterns in AI SDK packages
    for (const [key, value] of Object.entries(providerModule)) {
      if (typeof value === 'function') {
        if (key.startsWith('create') && key.length > 6) {
          createFunction = value;
        } else if (!key.startsWith('create') && !key.startsWith('_') && key.length < 15) {
          // Likely a default instance (openai, anthropic, etc.)
          defaultInstance = value;
        }
      }
    }
    
    // If we have a create function and an API key, use it
    if (createFunction && apiKey) {
      try {
        // Merge API key with any provider-specific options
        const config = { apiKey, ...providerOptions };
        return createFunction(config);
      } catch (error) {
        // Fallback to other configurations if basic one fails
        try {
          const config = { apiKey, ...providerOptions };
          return createFunction(config);
        } catch (error2) {
          // If still fails, try with minimal config
          return createFunction({ apiKey });
        }
      }
    }
    
    // Otherwise, try to use the default instance
    if (defaultInstance) {
      return defaultInstance;
    }
    
    // If we can't find a suitable export, throw an error
    throw new Error(`Could not find suitable provider factory in ${npmPackage}. Available exports: ${Object.keys(providerModule).join(', ')}`);
    
  } catch (error) {
    throw new Error(`Failed to import provider ${npmPackage}: ${error}`);
  }
}

/**
 * Get base URL for OpenAI-compatible providers from metadata
 */
function getBaseURLFromMetadata(metadata: any): string | null {
  // Check if metadata has baseURL or url field
  if (metadata?.baseURL) return metadata.baseURL;
  if (metadata?.url) return metadata.url;
  if (metadata?.endpoint) return metadata.endpoint;
  
  // Check in the env field for URL patterns
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

/**
 * Create AI SDK instance dynamically based on npm package from models.json
 */
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

  // Handle OpenAI-compatible providers
  if (npmPackage === "@ai-sdk/openai-compatible") {
    if (!apiKey) {
      throw new Error(`API key required for OpenAI-compatible provider: ${providerId}`);
    }

    const baseURL = getBaseURLFromMetadata(metadata);
    if (!baseURL) {
      throw new Error(`No base URL found for OpenAI-compatible provider: ${providerId}`);
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    
    const provider = createOpenAI({
      baseURL,
      apiKey: providerId === "ollama" ? "ollama" : apiKey, // Ollama doesn't require a real API key
      name: providerId,
    });
    
    return provider(modelId as any);
  }

    // Check if this is a server-only provider early
    const { isServerOnlyProvider } = await import('./provider-constants');
    if (isServerOnlyProvider(npmPackage)) {
      if (typeof window !== 'undefined') {
        throw new Error(`${npmPackage} models are only available on the server-side. Provider: ${providerId}, Model: ${modelId}`);
      }
      // Handle server-only providers
      const { getServerProvider } = await import('./server-providers');
      const provider = await getServerProvider(npmPackage, apiKey, metadata, providerOptions);
      return provider(modelId as any);
    }

  // Handle other npm packages
  const provider = await createProviderFromNpm(npmPackage, apiKey, metadata, providerOptions);
  return provider(modelId as any);
}

/**
 * Get all supported providers from models.json
 */
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

/**
 * Check if a model is supported by this dynamic provider system
 */
export async function isModelSupported(modelId: string): Promise<boolean> {
  try {
    const providerId = await getProviderFromModelId(modelId);
    return providerId !== null;
  } catch (error) {
    console.warn('Failed to check model support:', error);
    return false;
  }
}
