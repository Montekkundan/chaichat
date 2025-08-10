export type LLMGatewayModelProvider = {
	providerId: string;
	modelName: string;
	pricing?: {
		prompt?: string;
		completion?: string;
		image?: string;
	};
	streaming?: boolean;
	vision?: boolean;
	cancellation?: boolean;
	tools?: boolean;
};

export type LLMGatewayModel = {
	id: string;
	name: string;
	created?: number;
	description?: string;
	family?: string;
	architecture?: {
		input_modalities?: string[];
		output_modalities?: string[];
		tokenizer?: string;
	};
	top_provider?: {
		is_moderated?: boolean;
	};
	providers?: LLMGatewayModelProvider[];
	pricing?: {
		prompt?: string;
		completion?: string;
		image?: string;
		request?: string;
		input_cache_read?: string;
		input_cache_write?: string;
		web_search?: string;
		internal_reasoning?: string;
	};
	context_length?: number;
	per_request_limits?: Record<string, string>;
	supported_parameters?: string[];
	json_output?: boolean;
	deprecated_at?: string | null;
	deactivated_at?: string | null;
};

export type LLMGatewayModelsResponse = {
	data: LLMGatewayModel[];
};
