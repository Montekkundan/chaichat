export const env = {
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
	GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
	MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
	XAI_API_KEY: process.env.XAI_API_KEY,
};

export type UserEnvKeys = {
	openai?: string;
	anthropic?: string;
	google?: string;
	mistral?: string;
	xai?: string;
};

export function createEnvWithUserKeys(userKeys: UserEnvKeys = {}): typeof env {
	return {
		OPENAI_API_KEY: userKeys.openai || env.OPENAI_API_KEY,
		ANTHROPIC_API_KEY: userKeys.anthropic || env.ANTHROPIC_API_KEY,
		GOOGLE_API_KEY: userKeys.google || env.GOOGLE_API_KEY,
		MISTRAL_API_KEY: userKeys.mistral || env.MISTRAL_API_KEY,
		XAI_API_KEY: userKeys.xai || env.XAI_API_KEY,
	};
}
