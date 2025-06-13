export const env = {
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

export function createEnvWithUserKeys(
	userKeys: Record<string, string> = {},
): typeof env {
	return {
		OPENAI_API_KEY: userKeys.openai || env.OPENAI_API_KEY,
	};
}
