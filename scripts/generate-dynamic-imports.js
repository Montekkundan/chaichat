#!/usr/bin/env node

/**
 * Generate dynamic import cases for openproviders index.ts
 * This script reads the models.json file and generates the switch case statements
 * for dynamic imports to help webpack bundle the required AI SDK packages.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsPath = path.join(__dirname, '..', 'public', 'models.json');
const indexPath = path.join(__dirname, '..', 'src', 'lib', 'openproviders', 'index.ts');

console.log('Generating dynamic import cases for openproviders...');

// Read models.json
if (!fs.existsSync(modelsPath)) {
  console.error('models.json not found. Please run fetch-models.js first.');
  process.exit(1);
}

const modelsData = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));

// Server-only providers that use Node.js modules and should not be bundled for client-side
const SERVER_ONLY_PROVIDERS = [
  "@ai-sdk/google-vertex",
  "@ai-sdk/amazon-bedrock",
];

// Packages that are mentioned in models.json but not installed
const UNINSTALLED_PACKAGES = [
  "@ai-sdk/cerebras",
];

// Extract unique npm packages, excluding server-only and uninstalled providers
const npmPackages = new Set();

if (modelsData.providers) {
  for (const [providerName, providerData] of Object.entries(modelsData.providers)) {
    if (providerData.npm && 
        providerData.npm !== "@ai-sdk/openai-compatible" &&
        !SERVER_ONLY_PROVIDERS.includes(providerData.npm) &&
        !UNINSTALLED_PACKAGES.includes(providerData.npm)) {
      npmPackages.add(providerData.npm);
    }
  }
}

// Generate switch cases
const switchCases = Array.from(npmPackages).sort().map(npmPackage => {
  const chunkName = npmPackage.replace(/[@\/]/g, '-').replace(/^-/, '');
  return `        case "${npmPackage}":
          providerModule = await import(/* webpackChunkName: "${chunkName}" */ "${npmPackage}");
          break;`;
}).join('\n');

// Generate the complete switch statement
const dynamicImportCode = `        case "@ai-sdk/openai":
          providerModule = await import(/* webpackChunkName: "ai-sdk-openai" */ "@ai-sdk/openai");
          break;
        case "@ai-sdk/anthropic":
          providerModule = await import(/* webpackChunkName: "ai-sdk-anthropic" */ "@ai-sdk/anthropic");
          break;
        case "@ai-sdk/google":
          providerModule = await import(/* webpackChunkName: "ai-sdk-google" */ "@ai-sdk/google");
          break;
        case "@ai-sdk/google-vertex":
          providerModule = await import(/* webpackChunkName: "ai-sdk-google-vertex" */ "@ai-sdk/google-vertex");
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
        case "@ai-sdk/amazon-bedrock":
          providerModule = await import(/* webpackChunkName: "ai-sdk-amazon-bedrock" */ "@ai-sdk/amazon-bedrock");
          break;
        case "@ai-sdk/deepinfra":
          providerModule = await import(/* webpackChunkName: "ai-sdk-deepinfra" */ "@ai-sdk/deepinfra");
          break;
        case "@requesty/ai-sdk":
          providerModule = await import(/* webpackChunkName: "requesty-ai-sdk" */ "@requesty/ai-sdk");
          break;`;

console.log('Found npm packages:', Array.from(npmPackages).sort());
console.log('Excluded server-only providers:', SERVER_ONLY_PROVIDERS);
console.log('Excluded uninstalled packages:', UNINSTALLED_PACKAGES);
console.log('\nGenerated switch cases:');
console.log(dynamicImportCode);

console.log(`\nTo update the dynamic imports, replace the switch statement in ${indexPath}`);
console.log('with the generated code above.');

// Optionally, you could automatically update the file here
// For now, we'll just log the output so you can manually update it
