import type { UIMessage as MessageAISDK } from "@ai-sdk/react";

export function getSources(parts: MessageAISDK["parts"]) {
	const sources = parts
		?.filter(
			(part) => part.type === "source-url" || part.type === "source-document",
		)
		.map((part) => {
			if (part.type === "source-url") {
				return { url: part.url, title: part.title };
			}

			if (part.type === "source-document") {
				return { url: undefined, title: part.title, content: part.filename };
			}

			return null;
		})
		.filter(Boolean)
		.flat();

	const validSources =
		sources?.filter(
			(source) =>
				source && typeof source === "object" && source.url && source.url !== "",
		) || [];

	return validSources;
}
