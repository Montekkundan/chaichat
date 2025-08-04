import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url = 'https://models.dev/api.json';

console.log('Fetching models from Models.dev API...');

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const rawData = JSON.parse(data);
      
      const models = [];
      const seenModelIds = new Set();
      const providerMetadata = new Map(); // Store provider metadata
      
      // First pass: Extract provider metadata
      for (const [providerId, providerData] of Object.entries(rawData)) {
        if (typeof providerData === 'object' && providerData !== null) {
          const provider = providerData;
          const providerName = provider.name || providerId;
          
          const metadata = {
            apiDocs: provider.doc || null,
            npm: provider.npm || null,
            env: provider.env || null,
            baseURL: provider.api || null,
            url: provider.url || null
          };
          
          providerMetadata.set(providerName, metadata);
        }
      }
      
      // Second pass: Extract models with provider metadata
      for (const [providerId, providerData] of Object.entries(rawData)) {
        if (typeof providerData === 'object' && providerData !== null && providerData.models) {
          const provider = providerData;
          const providerName = provider.name || providerId;
          const metadata = providerMetadata.get(providerName);
          
          for (const [modelId, modelData] of Object.entries(provider.models || {})) {
            if (typeof modelData === 'object' && modelData !== null) {
              const model = modelData;
              let uniqueModelId = model.id || modelId;
              
              if (seenModelIds.has(uniqueModelId)) {
                uniqueModelId = `${uniqueModelId}-${providerId}`;
                let counter = 1;
                while (seenModelIds.has(uniqueModelId)) {
                  uniqueModelId = `${model.id || modelId}-${providerId}-${counter}`;
                  counter++;
                }
              }
              
              seenModelIds.add(uniqueModelId);
              
              models.push({
                id: uniqueModelId,
                name: model.name || modelId,
                provider: providerName,
                pricing: {
                  input: model.cost?.input,
                  output: model.cost?.output,
                  unit: '1M tokens',
                },
                context_window: model.limit?.context,
                capabilities: {
                  vision: model.modalities?.input?.includes('image') || false,
                  tools: model.tool_call || false,
                  audio: model.modalities?.input?.includes('audio') || false,
                  reasoningText: model.reasoningText || false,
                },
                released_at: model.release_date,
                description: `${model.name || modelId} from ${providerName}`,
                open_source: model.open_weights || false,
                // Include provider-level metadata
                apiDocs: metadata?.apiDocs || undefined,
              });
            }
          }
        }
      }
      
      const transformedData = {
        models,
        providers: Object.fromEntries(providerMetadata), // Include provider metadata for reference
        last_updated: new Date().toISOString(),
      };
      
      const publicDir = path.join(__dirname, '..', 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(publicDir, 'models.json'), JSON.stringify(transformedData, null, 2));
      console.log(`Successfully saved ${models.length} models to public/models.json`);
    } catch (error) {
      console.error('Error processing models data:', error);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('Error fetching models:', err);
  process.exit(1);
});
