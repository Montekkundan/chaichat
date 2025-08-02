// TODO cleanup

/**
 * Server-only providers that require Node.js modules
 */
export const SERVER_ONLY_PROVIDERS = [
  "@ai-sdk/google-vertex",
  "@ai-sdk/amazon-bedrock",
];

/**
 * Check if a provider is server-only
 */
export function isServerOnlyProvider(npmPackage: string): boolean {
  return SERVER_ONLY_PROVIDERS.includes(npmPackage);
}
