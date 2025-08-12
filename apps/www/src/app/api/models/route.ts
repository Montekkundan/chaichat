import type {
	LLMGatewayModel,
	LLMGatewayModelsResponse,
} from "~/types/llmgateway";

export async function GET() {
	try {
		const response = await fetch("https://api.llmgateway.io/v1/models");
		const data = (await response.json()) as LLMGatewayModelsResponse;

		if (!data.data || !Array.isArray(data.data)) {
			throw new Error("Invalid response format from LLM Gateway");
		}

		return Response.json({
			models: data.data.map((model: LLMGatewayModel) => ({
				id: model.id,
				name: model.name,
				description: model.description,
				family: model.family,
				context_length: model.context_length,
				pricing: model.pricing,
				providers: model.providers,
				architecture: model.architecture,
				top_provider: model.top_provider,
				json_output: model.json_output,
				deprecated_at: model.deprecated_at,
				deactivated_at: model.deactivated_at,
			})),
		});
	} catch (error) {
		console.error("Failed to fetch models from LLM Gateway:", error);
		return Response.json({ error: "Failed to load models" }, { status: 500 });
	}
}
