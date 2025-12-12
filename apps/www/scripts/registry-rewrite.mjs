// Rewrite alias imports inside generated registry JSON files
// Changes only affect files under public/r/*.json
// Rewrites: from "~/..." → from "@/..."

import fs from "node:fs";
import path from "node:path";

const registryDir = path.resolve(process.cwd(), "public", "r");

function isJsonFile(filePath) {
	return filePath.toLowerCase().endsWith(".json");
}

function readJson(filePath) {
	const raw = fs.readFileSync(filePath, "utf8");
	return JSON.parse(raw);
}

function writeJson(filePath, data) {
	const out = JSON.stringify(data, null, 2) + "\n";
	fs.writeFileSync(filePath, out, "utf8");
}

function rewriteContent(content) {
	if (typeof content !== "string" || content.length === 0) return content;
	// Replace common ESM import patterns
	let next = content.replaceAll("from \"~/", "from \"@/");
	next = next.replaceAll("from '\~/", "from '@/");
	// Replace side-effect imports like: import "~/..."
	next = next.replaceAll("import \"~/", "import \"@/");
	next = next.replaceAll("import '\~/", "import '@/");
	// Replace dynamic imports: import("~/...")
	next = next.replaceAll("import(\"~/", "import(\"@/");
	next = next.replaceAll("import('\~/", "import('@/");
	return next;
}

function processRegistryJson(filePath) {
	const data = readJson(filePath);
	if (!data || !Array.isArray(data.files)) return false;
	let changed = false;
	for (const fileEntry of data.files) {
		if (fileEntry && typeof fileEntry.content === "string") {
			const rewritten = rewriteContent(fileEntry.content);
			if (rewritten !== fileEntry.content) {
				fileEntry.content = rewritten;
				changed = true;
			}
		}
	}
	if (changed) writeJson(filePath, data);
	return changed;
}

function main() {
	if (!fs.existsSync(registryDir)) return;
	const entries = fs.readdirSync(registryDir);
	let totalChanged = 0;
	for (const entry of entries) {
		const full = path.join(registryDir, entry);
		if (fs.statSync(full).isFile() && isJsonFile(full)) {
			const changed = processRegistryJson(full);
			if (changed) totalChanged += 1;
		}
	}
	// eslint-disable-next-line no-console
	console.log(`registry-rewrite: updated ${totalChanged} file(s) in ${registryDir}`);
}

main();
