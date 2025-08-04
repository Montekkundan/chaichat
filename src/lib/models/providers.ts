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
import { filterProvidersByTested, filterModelsJsonByTested } from "./tested-providers";

export interface ProviderConfig {
	id: string;
	name: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	keyName: string;
	placeholder: string;
	requiresApiKey: boolean;
	apiDocs?: string;
}

const PROVIDER_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
	// === MAJOR AI PROVIDERS ===
	"openai": SiOpenai,
	"anthropic": SiAnthropic,
	"google": SiGoogle,
	"meta": SiMeta,
	"microsoft": TbCloud,
	"nvidia": SiNvidia,
	"amazon-bedrock": SiAmazon,
	
	// === CLOUD & PLATFORMS ===
	"vertex": SiGoogle,
	"azure": TbCloud,
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
	"alibaba": Building2,
	
	// === SPECIALIZED ===
	"ollama": TbCpu,
	"local": TbCpu,
	"llama": SiMeta,
	"requesty": TbApi,
	"cerebras": Globe,
	
	// === DEFAULT FALLBACK ===
	"default": Globe
};

export function normalizeProviderName(providerName: string): string {
	return providerName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function getProviderIcon(providerId: string): React.ComponentType<React.SVGProps<SVGSVGElement>> {
	if (PROVIDER_ICONS[providerId]) {
		return PROVIDER_ICONS[providerId];
	}
	
	for (const [key, icon] of Object.entries(PROVIDER_ICONS)) {
		if (key !== "default" && (providerId.includes(key) || key.includes(providerId))) {
			return icon;
		}
	}
	
	return PROVIDER_ICONS["default"] || Globe;
}

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
	
	for (const [key, prefix] of Object.entries(commonPrefixes)) {
		if (providerId.includes(key)) {
			return `${prefix} (from ${displayName})`;
		}
	}
	
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

function generateKeyName(providerId: string): string {
	if (providerId === 'github-models') {
		return 'githubModelsKey';
	}
	if (providerId === 'github-copilot') {
		return 'githubCopilotKey';
	}
	
	const camelCase = providerId
		.split('-')
		.map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
		.join('');
	
	return `${camelCase}Key`;
}

let providerConfigsCache: ProviderConfig[] | null = null;
let lastLoadTime = 0;
const CACHE_DURATION = 60000;

async function loadModelsData(): Promise<any> {
	if (typeof window !== 'undefined') {
		try {
			const response = await fetch('/models.json');
			if (response.ok) {
				const data = await response.json();
				return filterModelsJsonByTested(data);
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
			return filterModelsJsonByTested(data);
		}
	}
	return null;
}

export async function getProviderConfigs(): Promise<ProviderConfig[]> {
	const now = Date.now();
	
	if (providerConfigsCache && (now - lastLoadTime) < CACHE_DURATION) {
		return providerConfigsCache;
	}
	
	try {
		const modelsData = await loadModelsData();
		if (!modelsData?.models) {
			const fallback = getFallbackProviders();
			providerConfigsCache = fallback;
			lastLoadTime = now;
			return fallback;
		}
		
		const uniqueProviders = new Set<string>();
		const providerUrls = new Map<string, { apiDocs?: string }>();
		
		for (const model of modelsData.models) {
			if (model.provider) {
				uniqueProviders.add(model.provider);
				
				const normalizedId = normalizeProviderName(model.provider);
				if (!providerUrls.has(normalizedId) && (model.apiDocs)) {
					providerUrls.set(normalizedId, {
						apiDocs: model.apiDocs
					});
				}
			}
		}
		
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
				name: providerName,
				icon,
				keyName,
				placeholder,
				requiresApiKey: requiresKey,
				apiDocs: urls?.apiDocs
			});
		}
		
		configs.sort((a, b) => a.name.localeCompare(b.name));
		
		// Filter configs to only include tested providers
		const filteredConfigs = filterProvidersByTested(configs);
		
		providerConfigsCache = filteredConfigs;
		lastLoadTime = now;
		return filteredConfigs;
		
	} catch (error) {
		console.error('Failed to generate provider configs:', error);
		const fallback = getFallbackProviders();
		providerConfigsCache = fallback;
		lastLoadTime = now;
		return fallback;
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
