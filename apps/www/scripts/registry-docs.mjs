#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

async function readJsonSafe(file) {
    try {
        const raw = await fs.readFile(file, "utf8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function readFileIfExists(file) {
    try {
        return await fs.readFile(file, "utf8");
    } catch {
        return null;
    }
}

async function main() {
    const cwd = process.cwd();
    const rootRegistryFile = path.join(cwd, "registry.json");
    const publicDir = path.join(cwd, "public", "r");

    const root = await readJsonSafe(rootRegistryFile);
    if (!root || !Array.isArray(root.items)) {
        console.log("[registry-docs] No root registry.json items found – skipping.");
        return;
    }

    let updated = 0;
    for (const item of root.items) {
        const slug = item?.name;
        if (!slug) continue;

        // Prefer docs in registry.json; else look for README in block/component/page folder
        let docs = typeof item.docs === "string" ? item.docs : null;
        if (!docs) {
            const candidates = [
                path.join(cwd, "src", "registry", "blocks", slug, "README.md"),
                path.join(cwd, "src", "registry", "components", slug, "README.md"),
                path.join(cwd, "src", "registry", "pages", slug, "README.md"),
            ];
            for (const file of candidates) {
                const content = await readFileIfExists(file);
                if (content) {
                    docs = content;
                    break;
                }
            }
        }

        if (!docs) continue;

        const target = path.join(publicDir, `${slug}.json`);
        const json = await readJsonSafe(target);
        if (!json) continue;
        if (json.docs === docs) continue;
        json.docs = docs;
        await fs.writeFile(target, `${JSON.stringify(json, null, 2)}\n`, "utf8");
        updated++;
    }

    console.log(`[registry-docs] Updated docs for ${updated} item(s).`);
}

main().catch((err) => {
    console.error("[registry-docs] Failed:", err);
    process.exitCode = 1;
});


