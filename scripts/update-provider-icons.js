#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const MODELS_JSON_PATH = path.join(process.cwd(), 'public', 'models.json');
const PROVIDERS_TS_PATH = path.join(process.cwd(), 'src', 'lib', 'models', 'providers.ts');

/**
 * @param {string} providerName
 * @returns {string}
 */
function normalizeProviderName(providerName) {
	return providerName
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

function extractProvidersFromModels() {
	try {
		if (!fs.existsSync(MODELS_JSON_PATH)) {
			console.warn('models.json not found, skipping provider icons update');
			return new Set();
		}

		const modelsData = JSON.parse(fs.readFileSync(MODELS_JSON_PATH, 'utf8'));
		const providers = new Set();

		if (modelsData.models && Array.isArray(modelsData.models)) {
			for (const model of modelsData.models) {
				if (model.provider && typeof model.provider === 'string') {
					const normalizedId = normalizeProviderName(model.provider);
					if (normalizedId) {
						providers.add(normalizedId);
					}
				}
			}
		}

		return providers;
	} catch (error) {
		console.error('Failed to extract providers from models.json:', error instanceof Error ? error.message : String(error));
		return new Set();
	}
}

function extractExistingProviders() {
	try {
		if (!fs.existsSync(PROVIDERS_TS_PATH)) {
			console.error('providers.ts not found at:', PROVIDERS_TS_PATH);
			return new Set();
		}

		const content = fs.readFileSync(PROVIDERS_TS_PATH, 'utf8');
		const existing = new Set();

		const iconMapMatch = content.match(/const PROVIDER_ICONS[^{]*\{([\s\S]*?)\};/);
		if (iconMapMatch && iconMapMatch[1]) {
			const iconMapContent = iconMapMatch[1];
			const providerMatches = [...iconMapContent.matchAll(/"([^"]+)":/g)];
			
			for (const match of providerMatches) {
				const providerId = match[1];
				if (providerId !== 'default') {
					existing.add(providerId);
				}
			}
		}

		return existing;
	} catch (error) {
		console.error('Failed to extract existing providers:', error instanceof Error ? error.message : String(error));
		return new Set();
	}
}

/**
 * @param {Set<string>} newProviders
 */
function updateProvidersFile(newProviders) {
	if (newProviders.size === 0) {
		console.log('No new providers to add');
		return;
	}

	try {
		let content = fs.readFileSync(PROVIDERS_TS_PATH, 'utf8');
		
		const timestamp = new Date().toISOString();
		content = content.replace(
			/Generated from models\.json providers on: .*/,
			`Generated from models.json providers on: ${timestamp}`
		);

		const autoGenStart = content.indexOf('// === AUTO-GENERATED (update these manually) ===');
		const defaultFallbackStart = content.indexOf('// === DEFAULT FALLBACK ===');
		
		if (autoGenStart === -1 || defaultFallbackStart === -1) {
			console.error('Could not find AUTO-GENERATED section in providers.ts');
			return;
		}

		const newProviderEntries = Array.from(newProviders)
			.sort()
			.map(providerId => `\t"${providerId}": Globe, // TODO: Update with appropriate icon`)
			.join(',\n');

		const beforeAutoGen = content.substring(0, autoGenStart);
		const afterAutoGen = content.substring(defaultFallbackStart);
		
		const updatedContent = beforeAutoGen + 
			'// === AUTO-GENERATED (update these manually) ===\n' +
			'\t// New providers from models.json added automatically with Globe icon\n' +
			'\t// TODO: Update these with appropriate icons from the libraries above\n' +
			(newProviderEntries ? '\t' + newProviderEntries + ',\n\n\t' : '\t') +
			afterAutoGen;

		fs.writeFileSync(PROVIDERS_TS_PATH, updatedContent, 'utf8');
		
		console.log(`Added ${newProviders.size} new provider(s) to providers.ts:`);
		for (const provider of newProviders) {
			console.log(`   - ${provider}`);
		}
		console.log('Don\'t forget to manually update the icons for new providers!');
		
	} catch (error) {
		console.error('Failed to update providers.ts:', error instanceof Error ? error.message : String(error));
	}
}

export async function updateProviderIcons() {
	console.log('Updating provider icons...');

	console.log('Reading providers from models.json...');
	const modelsProviders = extractProvidersFromModels();
	console.log(`Found ${modelsProviders.size} providers in models.json`);

	console.log('Reading existing providers from providers.ts...');
	const existingProviders = extractExistingProviders();
	console.log(`Found ${existingProviders.size} existing providers in providers.ts`);

	const newProviders = new Set();
	for (const provider of modelsProviders) {
		if (!existingProviders.has(provider)) {
			newProviders.add(provider);
		}
	}

	if (newProviders.size > 0) {
		console.log(`Found ${newProviders.size} new provider(s):`);
		for (const provider of newProviders) {
			console.log(`   - ${provider}`);
		}
	}

	updateProvidersFile(newProviders);
	
	console.log('Provider icons update complete!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
	updateProviderIcons();
}
