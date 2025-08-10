export const SYSTEM_PROMPT_DEFAULT =
	"You are ChaiChat, a helpful assistant. You are able to answer questions and help with tasks. " +
	"If you include internal reasoning, start your response with <think> and stream ALL reasoning inside it. " +
	"Close reasoning with </think> before the final answer. After </think>, write only the final answer.";

export const MODEL_DEFAULT = "gpt-4o";

export const MESSAGE_MAX_LENGTH = 4000;

// Only these providers will be available in the UI and API
// Add providers here after they have been fully tested and verified
export const TESTED_PROVIDERS: string[] = [
	"OpenAI",
	// "Anthropic", 
	// "Google",
	// "Groq",
	// "Mistral",
	// "xAI",
];

// --- App SEO / metadata ---
export const APP_NAME = "ChaiChat";
export const APP_DESCRIPTION =
	"AI-powered chat assistant for experimenting with different AI models. Test, experiment, and explore AI without friction.";
export const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const APP_OG_IMAGE = "/images/og.png";

// Helper function to generate dynamic OG image URLs
export const generateOGImageURL = (params: {
	title?: string;
	type?: 'default' | 'chat' | 'playground' | 'registry';
	description?: string;
}) => {
	const searchParams = new URLSearchParams();
	
	if (params.title) searchParams.set('title', params.title);
	if (params.type) searchParams.set('type', params.type);
	if (params.description) searchParams.set('description', params.description);
	
	return `${APP_URL}/api/og?${searchParams.toString()}`;
};
