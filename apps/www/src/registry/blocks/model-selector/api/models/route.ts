type LLMGatewayModelProvider = {
	providerId: string;
	modelName: string;
	pricing?: Record<string, string | undefined>;
	streaming?: boolean;
	vision?: boolean;
	tools?: boolean;
};

type LLMGatewayModel = {
	id: string;
	name: string;
	description?: string;
	family?: string;
	architecture?: Record<string, unknown>;
	providers?: LLMGatewayModelProvider[];
	pricing?: Record<string, string | undefined>;
	context_length?: number;
	json_output?: boolean;
	deprecated_at?: string | null;
	deactivated_at?: string | null;
	top_provider?: { is_moderated?: boolean };
};

type LLMGatewayModelsResponse = {
	data: LLMGatewayModel[];
};

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


