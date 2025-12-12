import fs from "node:fs/promises";
import path from "node:path";

export type RegistryItemFile = {
	path: string;
	content?: string;
	type?: string;
};

export type RegistryItem = {
	$schema?: string;
	name: string;
	type: string;
	title: string;
	description?: string;
	dependencies?: string[];
	registryDependencies?: string[];
	files: RegistryItemFile[];
	docs?: string;
};

const REGISTRY_DIR = path.join(process.cwd(), "public", "r");
const ROOT_REGISTRY_FILE = path.join(process.cwd(), "apps", "www", "registry.json");

export async function readRegistryItemSlugs(): Promise<string[]> {
	const entries = await fs.readdir(REGISTRY_DIR);
	return entries
		.filter((file) => file.endsWith(".json"))
		.map((file) => file.replace(/\.json$/i, ""))
		.sort();
}

export async function readRegistryItem(slug: string): Promise<RegistryItem | null> {
	try {
		const full = path.join(REGISTRY_DIR, `${slug}.json`);
		const raw = await fs.readFile(full, "utf8");
		return JSON.parse(raw) as RegistryItem;
	} catch {
		try {
			const raw = await fs.readFile(ROOT_REGISTRY_FILE, "utf8");
			const parsed = JSON.parse(raw) as { items?: RegistryItem[] };
			const match = Array.isArray(parsed.items)
				? parsed.items.find((it) => it && typeof it === "object" && it.name === slug)
				: undefined;
			return match ? (match as RegistryItem) : null;
		} catch {
			return null;
		}
	}
}

export async function readAllRegistryItems(): Promise<Array<RegistryItem & { slug: string }>> {
	const slugs = await readRegistryItemSlugs();
	const fileItems = await Promise.all(
		slugs.map(async (slug) => {
			const item = await readRegistryItem(slug);
			return item ? { ...item, slug } : null;
		}),
	);

	let rootItems: Array<RegistryItem & { slug: string }> = [];
	try {
		const raw = await fs.readFile(ROOT_REGISTRY_FILE, "utf8");
		const parsed = JSON.parse(raw) as { items?: RegistryItem[] };
		if (Array.isArray(parsed.items)) {
			rootItems = parsed.items.map((it) => ({ ...it, slug: it.name }));
		}
	} catch {}

	const safeFileItems = (fileItems.filter(Boolean) as Array<RegistryItem & { slug: string }>);
	const merged = [...safeFileItems, ...rootItems];
	const seen = new Set<string>();
	const result: Array<RegistryItem & { slug: string }> = [];
	for (const item of merged as Array<RegistryItem & { slug: string }>) {
		const slug = item?.slug as string | undefined;
		if (!slug) continue;
		if (!seen.has(slug)) {
			seen.add(slug);
			result.push(item);
		}
	}
	return result;
}

export function extractMarkdownHeadings(markdown?: string): { id: string; text: string; level: number }[] {
	if (!markdown) return [];
	const lines = markdown.split(/\r?\n/);
	const headings: { id: string; text: string; level: number }[] = [];
	for (const line of lines) {
		const m = /^(#{1,3})\s+(.+)$/.exec(line.trim());
		if (m) {
			const hashes = (m[1] as string) || "";
			const title = (m[2] as string) || "";
			const level = (hashes || "").length; // 1-3
			const text = (title || "").trim();
			const id = text
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "")
				.trim()
				.replace(/\s+/g, "-");
			headings.push({ id, text, level });
		}
	}
	return headings;
}

interface RichTextContent {
	content?: RichTextNode[];
}

interface RichTextNode {
	type: string;
	attrs?: {
		level?: number;
		[key: string]: unknown;
	};
	content?: RichTextNode[];
	text?: string;
}

export function extractRichTextHeadings(content?: RichTextContent): { id: string; text: string; level: number }[] {
	if (!content?.content || !Array.isArray(content.content)) return [];

	const headings: { id: string; text: string; level: number }[] = [];

	function processContentItem(item: RichTextNode) {
		if (item.type === 'heading' && item.attrs?.level && item.content) {
			const level = item.attrs.level;
			if (level === 1 || level === 2) {
				let text = '';
				if (item.content && Array.isArray(item.content)) {
					text = item.content
						.filter((child: RichTextNode) => child.type === 'text')
						.map((child: RichTextNode) => child.text || '')
						.join('')
						.trim();
				}

				if (text) {
					const id = text
						.toLowerCase()
						.replace(/[^a-z0-9\s-]/g, "")
						.trim()
						.replace(/\s+/g, "-");

					headings.push({ id, text, level });
				}
			}
		}

		if (item.content && Array.isArray(item.content)) {
			item.content.forEach(processContentItem);
		}
	}

	content.content.forEach(processContentItem);
	return headings;
}


