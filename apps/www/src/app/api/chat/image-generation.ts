import { createGateway as createVercelGateway } from "@ai-sdk/gateway";
import { createLLMGateway } from "@llmgateway/ai-sdk-provider";
import { experimental_generateImage, generateText } from "ai";

type UsedGateway = "llm-gateway" | "vercel-ai-gateway";

export type GeneratedImage = {
	name: string;
	url: string;
	contentType: string;
	size: number;
};

// TODO : need to make this better so that it works with specific image output models.
export async function generateImagesViaGateway(params: {
	usedGateway: UsedGateway;
	modelId: string;
	prompt: string;
	size?: "256x256" | "512x512" | "1024x1024";
	n?: number;
	llmKey?: string;
	aiKey?: string;
}): Promise<GeneratedImage[]> {
	const { usedGateway, modelId, prompt } = params;
	const size = (params.size || "1024x1024") as "256x256" | "512x512" | "1024x1024";
	const n = typeof params.n === "number" && params.n > 0 ? params.n : 1;

	const llmGatewayProvider = createLLMGateway({
		apiKey: params.llmKey ?? "",
		compatibility: "strict",
	});
	const vercelGatewayProvider = createVercelGateway({ apiKey: params.aiKey ?? "" });
	const provider = usedGateway === "vercel-ai-gateway" ? vercelGatewayProvider : llmGatewayProvider;

	// Path 1: OpenAI DALL·E-style image generation via experimental_generateImage
	if (/dall-e/i.test(modelId)) {
		const imageModelFactory: (id: string) => unknown =
			(provider as unknown as { imageModel?: (id: string) => unknown }).imageModel?.bind(provider) ??
			(provider as unknown as (id: string) => unknown);
		const out: GeneratedImage[] = [];
		for (let i = 0; i < n; i++) {
			const { image } = await experimental_generateImage({
				model: imageModelFactory(modelId) as unknown as never,
				prompt,
				size,
			});
			out.push({
				name: `generated-${Date.now()}-${i + 1}.png`,
				url: `data:image/png;base64,${image.base64}`,
				contentType: "image/png",
				size: Math.round(image.base64.length * 0.75),
			});
		}
		return out;
	}

	// Path 2: Gemini image-preview models generate images via generateText with responseModalities
	if (/gemini/i.test(modelId) && /image-preview/i.test(modelId)) {
		const result = await generateText({
			model: provider(modelId),
			providerOptions: {
				// Enable image outputs for Google Gemini image-preview models
				google: { responseModalities: ["TEXT", "IMAGE"] },
			},
			prompt,
		});
		const images: GeneratedImage[] = [];
		for (const file of result.files ?? []) {
			try {
				if (typeof file?.mediaType === "string" && file.mediaType.startsWith("image/")) {
					// Prefer direct URL if provided by the provider
					// biome-ignore lint/suspicious/noExplicitAny: provider file shape
					const anyFile = file as any;
					const url: string | undefined = anyFile.url || anyFile.uri || anyFile.href;
					if (typeof url === "string" && url.length > 0) {
						images.push({
							name: anyFile.name || `generated-${Date.now()}.png`,
							url,
							contentType: file.mediaType,
							size: typeof anyFile.size === "number" ? anyFile.size : 0,
						});
					}
				}
			} catch {}
		}
		if (images.length > 0) return images;
		throw new Error("No image files returned by the model");
	}

	// Generic fallback: try experimental_generateImage with provided modelId
	try {
		const imageModelFactory: (id: string) => unknown =
			(provider as unknown as { imageModel?: (id: string) => unknown }).imageModel?.bind(provider) ??
			(provider as unknown as (id: string) => unknown);
		const { image } = await experimental_generateImage({
			model: imageModelFactory(modelId) as unknown as never,
			prompt,
			size,
		});
		return [
			{
				name: `generated-${Date.now()}-1.png`,
				url: `data:image/png;base64,${image.base64}`,
				contentType: "image/png",
				size: Math.round(image.base64.length * 0.75),
			},
		];
	} catch (e) {
		throw new Error(
			`Image generation not supported for model "${modelId}" via ${usedGateway}: ${e instanceof Error ? e.message : String(e)}`,
		);
	}
}


