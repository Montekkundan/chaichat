// TODO cleanup

import type React from "react";
import { 
	SiOpenai, 
	SiGoogle, 
	SiAnthropic,
	SiMeta,
	SiNvidia,
	SiAmazon,
	SiGithub,
	SiFirebase
} from "react-icons/si";
import { 
	TbBrandOpenai, 
	TbBrandGoogle, 
	TbCloud, 
	TbBrain,
	TbRobot,
	TbCpu,
	TbCloudComputing,
	TbNetwork,
	TbApi
} from "react-icons/tb";
import { Building2, Zap, Globe, Brain, Code2, Sparkles, Cpu, Bot, Network } from "lucide-react";

export interface ProviderConfig {
	id: string;
	name: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	keyName: string;
	placeholder: string;
	requiresApiKey: boolean;
	apiDocs?: string;
}

/**
 * STATIC PROVIDER ICONS MAPPING
 * 
 * This is the master list of provider icons. Update this manually when you want to
 * change icons for providers. New providers from models.json get added automatically
 * with Globe icon during build - you can then update them here.
 * 
 * Generated from models.json providers on: 2025-08-01T21:30:02.831Z
 */
const PROVIDER_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
	// === MAJOR AI PROVIDERS ===
	"openai": SiOpenai,
	"anthropic": SiAnthropic,
	"google": SiGoogle,
	"meta": SiMeta,
	"microsoft": TbCloud, // No SiMicrosoft available, using cloud icon
	"nvidia": SiNvidia,
	"amazon-bedrock": SiAmazon,
	
	// === CLOUD & PLATFORMS ===
	"vertex": SiGoogle,
	"azure": TbCloud, // Microsoft Azure using cloud icon
	"github-models": SiGithub,
	"github-copilot": SiGithub,
	"vercel-ai-gateway": TbCloud,
	"inference": TbCloudComputing,
	
	// === AI PROVIDERS & SERVICES ===
	"openrouter": TbNetwork,
	"hugging-face": Brain,
	"together-ai": TbCpu,
	"mistral": Brain,
	"groq": Cpu,
	"deepseek": Bot,
	"perplexity": Brain,
	"cohere": TbBrain,
	"replicate": Sparkles,
	"fireworks-ai": Sparkles,
	"xai": TbRobot,
	"v0": Code2,
	"upstage": TbApi,
	
	// === INFRASTRUCTURE ===
	"deep-infra": Building2,
	"weights-biases": TbCloudComputing,
	"venice-ai": TbCloud,
	"morph": TbNetwork,
	"alibaba": Building2, // No SiAlibaba available, using building icon
	
	// === SPECIALIZED ===
	"ollama": TbCpu,
	"local": TbCpu,
	"llama": SiMeta,
	"requesty": TbApi,
	
	// === AUTO-GENERATED (update these manually) ===
	// New providers from models.json added automatically with Globe icon
	// TODO: Update these with appropriate icons from the libraries above
		"cerebras": Globe, // TODO: Update with appropriate icon,

	// === DEFAULT FALLBACK ===
	"default": Globe
};

/**
 * Normalize provider name to ID
 */
export function normalizeProviderName(providerName: string): string {
	return providerName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Get icon for provider - uses exact match from PROVIDER_ICONS
 */
function getProviderIcon(providerId: string): React.ComponentType<React.SVGProps<SVGSVGElement>> {
	// Try exact match first
	if (PROVIDER_ICONS[providerId]) {
		return PROVIDER_ICONS[providerId];
	}
	
	// Try partial matches for known providers
	for (const [key, icon] of Object.entries(PROVIDER_ICONS)) {
		if (key !== "default" && (providerId.includes(key) || key.includes(providerId))) {
			return icon;
		}
	}
	
	// Default fallback
	return PROVIDER_ICONS["default"] || Globe;
}

/**
 * Generate placeholder text for API key input
 */
function generatePlaceholder(providerId: string, displayName: string): string {
	const commonPrefixes: Record<string, string> = {
		"openai": "sk-...",
		"anthropic": "sk-ant-...",
		"google": "AI...",
		"mistral": "mst-...",
		"groq": "gsk_...",
		"deepseek": "sk-...",
		"nvidia": "nvapi-...",
		"huggingface": "hf_...",
		"replicate": "r8_...",
		"cohere": "co-...",
		"perplexity": "pplx-..."
	};
	
	// Check for known prefix
	for (const [key, prefix] of Object.entries(commonPrefixes)) {
		if (providerId.includes(key)) {
			return `${prefix} (from ${displayName})`;
		}
	}
	
	// Generic format
	const prefix = displayName.toLowerCase().substring(0, 3);
	return `${prefix}-... (from ${displayName})`;
}


function requiresApiKey(providerId: string): boolean {
	const freeProviders = [
		"ollama",
		"local",
		"huggingface-free"
	];
	
	return !freeProviders.some(free => providerId.includes(free));
}

/**
 * Generate key name for UserKeys interface
 */
function generateKeyName(providerId: string): string {
	// Convert provider ID to camelCase + Key
	const camelCase = providerId
		.split('-')
		.map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
	
	return `${camelCase}Key`;
}

/**
 * Cache for provider configs
 */
let providerConfigsCache: ProviderConfig[] | null = null;

/**
 * Load models data from models.json
 */
async function loadModelsData(): Promise<any> {
	if (typeof window !== 'undefined') {
		try {
			const response = await fetch('/models.json');
			if (response.ok) {
				return await response.json();
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
			return JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
		}
	}
	return null;
}

/**
 * Get all provider configurations dynamically from models.json
 */
export async function getProviderConfigs(): Promise<ProviderConfig[]> {
	if (providerConfigsCache) {
		return providerConfigsCache;
	}
	
	try {
		const modelsData = await loadModelsData();
		if (!modelsData?.models) {
			console.warn('No models data found, using fallback providers');
			return getFallbackProviders();
		}
		
		// Extract unique providers and their metadata
		const uniqueProviders = new Set<string>();
		const providerUrls = new Map<string, { apiDocs?: string }>();
		
		for (const model of modelsData.models) {
			if (model.provider) {
				uniqueProviders.add(model.provider);
				
				// Extract provider URLs from the first model that has them
				const normalizedId = normalizeProviderName(model.provider);
				if (!providerUrls.has(normalizedId) && (model.apiDocs)) {
					providerUrls.set(normalizedId, {
						apiDocs: model.apiDocs
					});
				}
			}
		}
		
		// Generate provider configs
		const configs: ProviderConfig[] = [];
		for (const providerName of uniqueProviders) {
			const id = normalizeProviderName(providerName);
			const icon = getProviderIcon(id);
			const keyName = generateKeyName(id);
			const placeholder = generatePlaceholder(id, providerName);
			const requiresKey = requiresApiKey(id);
			const urls = providerUrls.get(id);
			
			configs.push({
				id,
				name: providerName, // Keep original name from models.json
				icon,
				keyName,
				placeholder,
				requiresApiKey: requiresKey,
				apiDocs: urls?.apiDocs
			});
		}
		
		// Sort by name
		configs.sort((a, b) => a.name.localeCompare(b.name));
		
		providerConfigsCache = configs;
		return configs;
		
	} catch (error) {
		console.error('Failed to generate provider configs:', error);
		return getFallbackProviders();
	}
}

/**
 * Get provider config by ID
 */
export async function getProviderConfig(providerId: string): Promise<ProviderConfig | undefined> {
	const configs = await getProviderConfigs();
	return configs.find(config => config.id === providerId);
}

/**
 * Fallback providers when models.json is not available
 */
function getFallbackProviders(): ProviderConfig[] {
	return [
		{
			id: "openai",
			name: "OpenAI",
			icon: SiOpenai,
			keyName: "openaiKey",
			placeholder: "sk-... (from OpenAI dashboard)",
			requiresApiKey: true,
			apiDocs: "https://platform.openai.com/docs/api-reference"
		},
		{
			id: "anthropic",
			name: "Anthropic",
			icon: SiAnthropic,
			keyName: "anthropicKey",
			placeholder: "sk-ant-... (from Anthropic console)",
			requiresApiKey: true,
			apiDocs: "https://docs.anthropic.com/en/api/getting-started"
		},
		{
			id: "google",
			name: "Google",
			icon: SiGoogle,
			keyName: "googleKey",
			placeholder: "AI... (from Google AI Studio)",
			requiresApiKey: true,
			apiDocs: "https://ai.google.dev/gemini-api/docs"
		}
	];
}

/**
 * Clear cache (for development/testing)
 */
export function clearProviderCache(): void {
	providerConfigsCache = null;
}

/**
 * Legacy PROVIDERS array for backwards compatibility
 * This dynamically generates the array from provider configs
 */
export async function getProviders(): Promise<Array<{
	id: string;
	name: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}>> {
	const configs = await getProviderConfigs();
	return configs.map(config => ({
		id: config.id,
		name: config.name,
		icon: config.icon
	}));
}

/**
 * Get a map of provider IDs to their corresponding key names.
 */
export async function getProviderKeyMap(): Promise<Record<string, string | undefined>> {
	const providers = await getProviderConfigs();
	
	const keyMap: Record<string, string | undefined> = {};
	for (const provider of providers) {
		keyMap[provider.id] = provider.requiresApiKey ? provider.keyName : undefined;
	}
	
	return keyMap;
}
