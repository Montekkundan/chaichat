// TODO cleanup

'use server';

import { SERVER_ONLY_PROVIDERS } from './provider-constants';

/**
 * Get server-only provider module and create instance
 */
export async function getServerProvider(npmPackage: string, apiKey?: string, metadata?: any, providerOptions?: any): Promise<any> {
  switch (npmPackage) {
    case "@ai-sdk/google-vertex": {
      const vertexModule = await import("@ai-sdk/google-vertex");
      
      // Try to find the appropriate create function
      let createFunction = null;
      let defaultInstance = null;
      
      for (const [key, value] of Object.entries(vertexModule)) {
        if (typeof value === 'function') {
          if (key.startsWith('create') && key.length > 6) {
            createFunction = value;
          } else if (!key.startsWith('create') && !key.startsWith('_') && key.length < 15) {
            defaultInstance = value;
          }
        }
      }
      
      // If we have a create function, use it
      if (createFunction) {
        const config: any = {};
        
        // Add configuration from metadata or environment
        if (metadata?.env) {
          if (process.env.GOOGLE_VERTEX_PROJECT) config.project = process.env.GOOGLE_VERTEX_PROJECT;
          if (process.env.GOOGLE_VERTEX_LOCATION) config.location = process.env.GOOGLE_VERTEX_LOCATION;
          if (process.env.GOOGLE_APPLICATION_CREDENTIALS) config.credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        }
        
        // Merge any provider-specific options
        if (providerOptions) {
          Object.assign(config, providerOptions);
        }
        
        return createFunction(config);
      }
      
      // Otherwise use default instance
      if (defaultInstance) {
        return defaultInstance;
      }
      
      throw new Error(`Could not find suitable provider factory in @ai-sdk/google-vertex. Available exports: ${Object.keys(vertexModule).join(', ')}`);
    }
    
    case "@ai-sdk/amazon-bedrock": {
      const bedrockModule = await import("@ai-sdk/amazon-bedrock");
      
      // Try to find the appropriate create function
      let createFunction = null;
      let defaultInstance = null;
      
      for (const [key, value] of Object.entries(bedrockModule)) {
        if (typeof value === 'function') {
          if (key.startsWith('create') && key.length > 6) {
            createFunction = value;
          } else if (!key.startsWith('create') && !key.startsWith('_') && key.length < 15) {
            defaultInstance = value;
          }
        }
      }
      
      // If we have a create function, use it
      if (createFunction) {
        const config: any = {};
        
        // Add configuration from metadata or environment
        if (metadata?.env) {
          if (process.env.AWS_ACCESS_KEY_ID) config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
          if (process.env.AWS_SECRET_ACCESS_KEY) config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
          if (process.env.AWS_REGION) config.region = process.env.AWS_REGION;
        }
        
        // Merge any provider-specific options
        if (providerOptions) {
          Object.assign(config, providerOptions);
        }
        
        return createFunction(config);
      }
      
      // Otherwise use default instance
      if (defaultInstance) {
        return defaultInstance;
      }
      
      throw new Error(`Could not find suitable provider factory in @ai-sdk/amazon-bedrock. Available exports: ${Object.keys(bedrockModule).join(', ')}`);
    }
    
    default:
      throw new Error(`Server provider ${npmPackage} not found`);
  }
}
