export const SYSTEM_PROMPT_DEFAULT =
	"You are ChaiChat, a helpful assistant. You are able to answer questions and help with tasks.";

export const MODEL_DEFAULT = "gpt-4o";

export const MESSAGE_MAX_LENGTH = 4000;

// --- App SEO / metadata ---
export const APP_NAME = "ChaiChat";
export const APP_DESCRIPTION =
	"AI-powered chat assistant for experimenting with different AI models. Test, experiment, and explore AI without friction.";
export const APP_URL =
	process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const APP_OG_IMAGE = "/images/og.png";


// All models require user's own API keys (BYOK - Bring Your Own Key)
export const BYOK_MODEL_IDS = [
	"gpt-4o",
	"claude-3-7-sonnet-20250219",
	"gemini-2.0-flash-001",
	"grok-3",
	"ministral-3b-latest",
];
