#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @param {string} scriptPath
 * @returns {Promise<void>}
 */
function runScript(scriptPath) {
	return new Promise((resolve, reject) => {
		console.log(`Running: ${scriptPath.split('/').pop()}`);
		
		const child = spawn('node', [scriptPath], {
			cwd: process.cwd(),
			stdio: 'inherit'
		});

		child.on('close', (code) => {
			if (code === 0) {
				console.log(`Completed: ${scriptPath.split('/').pop()}`);
				resolve(undefined);
			} else {
				console.error(`Failed: ${scriptPath.split('/').pop()} (exit code: ${code})`);
				reject(new Error(`Script failed with exit code ${code}`));
			}
		});

		child.on('error', (error) => {
			console.error(`Error running ${scriptPath.split('/').pop()}:`, error.message);
			reject(error);
		});
	});
}

async function main() {
	try {
		console.log('Starting build scripts...');
		
		const fetchModelsScript = join(__dirname, 'fetch-models.js');
		await runScript(fetchModelsScript);
		
		const updateProvidersScript = join(__dirname, 'update-provider-icons.js');
		await runScript(updateProvidersScript);
		
		const generateDynamicImportsScript = join(__dirname, 'generate-dynamic-imports.js');
		await runScript(generateDynamicImportsScript);
		
		console.log('All build scripts completed successfully!');
		console.log('Models fetched to public/models.json');
		console.log('Provider icons updated in providers.ts');
		console.log('Dynamic imports generated for openproviders/index.ts');
		
	} catch (error) {
		console.error('Build scripts failed:', (error instanceof Error) ? error.message : String(error));
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { main as runBuildScripts };
