import type { ModelMessage } from "ai";

export function hasImageParts(messages: ModelMessage[]): boolean {
  try {
    return messages.some((msg) => {
      if (!Array.isArray(msg.content)) return false;
      return msg.content.some((p) => {
        const part = p as { type?: string; mediaType?: string };
        if (part.type === "image") return true;
        if (part.type === "file" && typeof part.mediaType === "string" && part.mediaType.startsWith("image/")) return true;
        return false;
      });
    });
  } catch {
    return false;
  }
}

// Currently a pass-through that keeps URLs rather than inlining as data URLs to avoid large payloads.
export async function inlineExternalMedia(messages: ModelMessage[]): Promise<ModelMessage[]> {
  const out: ModelMessage[] = [];
  for (const m of messages) {
    if (!Array.isArray(m.content as unknown)) {
      out.push(m);
      continue;
    }
    const parts = m.content as Array<unknown>;
    const newParts: Array<unknown> = [];
    for (const p of parts) {
      const part = p as { type?: string; image?: string; mimeType?: string; url?: string; mediaType?: string };
      newParts.push(part);
    }
    out.push({ ...m, content: newParts } as ModelMessage);
  }
  return out;
}
