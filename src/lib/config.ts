export const SYSTEM_PROMPT_DEFAULT =
	"You are ChaiChat, a helpful assistant. You are able to answer questions and help with tasks.";

export const MODEL_DEFAULT = "gpt-4o";

export const MESSAGE_MAX_LENGTH = 4000;

// Default theme applied to new users (must match one in themes.css)
// default themes goes to globals.css
export const DEFAULT_APP_THEME = "t3chat";

// Recommended models to show user
export const RECOMMENDED_MODEL_IDS = ["gpt-4o", "gemini-2.0-flash-001"];

// Subscription plan definitions
export const PLANS = {
	anonymous: { total: 10, premium: 0, periodMs: undefined }, // no refill
	free: { total: 20, premium: 0, periodMs: 24 * 60 * 60 * 1000 }, // 24h
	pro: { total: 1500, premium: 100, periodMs: 30 * 24 * 60 * 60 * 1000 }, // 30d
} as const;

export const FREE_MODELS_IDS = ["gpt-4o"];

export const PREMIUM_MODEL_IDS = [
	"claude-3-7-sonnet-20250219",
	"gemini-2.0-flash-001",
	"grok-3",
	"ministral-3b-latest",
];
