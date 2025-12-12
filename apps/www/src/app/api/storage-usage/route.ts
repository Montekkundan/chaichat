import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { list } from "@vercel/blob";
import { UTApi } from "uploadthing/server";
import { env } from "~/env";
import { api } from "@/convex/_generated/api";

// Run on the Edge for better performance
export const runtime = "edge";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const revalidate = 300; // Cache for 5 minutes

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);

type LocalKeys = {
	llmGatewayApiKey?: string;
	aiGatewayApiKey?: string;
	uploadThingApiKey?: string;
	vercelBlobApiKey?: string;
	storageProvider?: "uploadthing" | "vercelblob";
};

type StorageUsageResponse = {
	uploadThing?: {
		usedBytes: number;
		totalBytes?: number;
		fileCount: number;
	};
	vercelBlob?: {
		usedBytes: number;
		totalBytes?: number;
		fileCount: number;
	};
	activeProvider: "uploadthing" | "vercelblob";
};

export async function GET(request: Request) {
	try {
		let uploadThingUsage = null;
		let vercelBlobUsage = null;
		let activeProvider: "uploadthing" | "vercelblob" = "uploadthing";

		// Get user API keys - try Convex first, then fallback to localStorage
		let uploadThingKey: string | undefined;
		let vercelBlobKey: string | undefined;
		let storageProvider: "uploadthing" | "vercelblob" = "uploadthing";

		try {
			const user = await currentUser();
			if (user?.id) {
				// Try to get keys from Convex for logged-in users
				try {
					const convexKeys = await convex.action(
						api.userKeys.getUserKeysForAPI,
						{
							userId: user.id,
						},
					) as LocalKeys;
					if (convexKeys?.uploadThingApiKey) {
						uploadThingKey = convexKeys.uploadThingApiKey.replace(/^['"]?UPLOADTHING_TOKEN=['"]?/i, '').replace(/^['"]|['"]$/g, '');
					}
					if (convexKeys?.vercelBlobApiKey) {
						vercelBlobKey = convexKeys.vercelBlobApiKey;
					}
					if (convexKeys?.storageProvider) {
						storageProvider = convexKeys.storageProvider;
					}
				} catch (convexError) {
					console.warn("Failed to get keys from Convex, falling back to localStorage:", convexError);
				}
			}
		} catch (error) {
			console.warn("Failed to get current user:", error);
		}

		// Fallback to localStorage keys from request headers if keys not found in Convex or user not logged in
		if (!uploadThingKey || !vercelBlobKey || storageProvider === "uploadthing") {
			try {
				// Try to get keys from request headers (passed from client)
				const localKeysHeader = request.headers.get("X-Local-Keys");
				if (localKeysHeader) {
					const localKeys = JSON.parse(localKeysHeader);
					console.log("Local keys from headers:", localKeys);
					if (!uploadThingKey && localKeys.uploadThingApiKey) {
						uploadThingKey = localKeys.uploadThingApiKey.replace(/^['"]?UPLOADTHING_TOKEN=['"]?/i, '').replace(/^['"]|['"]$/g, '');
					}
					if (!vercelBlobKey && localKeys.vercelBlobApiKey) {
						vercelBlobKey = localKeys.vercelBlobApiKey;
					}
					if (localKeys.storageProvider) {
						storageProvider = localKeys.storageProvider;
					}
				}
			} catch (localError) {
				console.warn("Failed to get keys from request headers:", localError);
			}
		}

		activeProvider = storageProvider;
		if (uploadThingKey) {
			try {
				const originalToken = process.env.UPLOADTHING_TOKEN;
				process.env.UPLOADTHING_TOKEN = uploadThingKey;

				try {
					const utapi = new UTApi();

					const files = await utapi.listFiles();

					let totalBytes = 0;
					let fileCount = 0;

					for (const file of files.files) {
						totalBytes += file.size;
						fileCount++;
					}

					// UploadThing doesn't provide direct quota info via API
					// Only show usage if we have files, without totalBytes field
					uploadThingUsage = {
						usedBytes: totalBytes,
						fileCount: fileCount,
					};

					console.log(`UploadThing usage: ${fileCount} files, ${totalBytes} bytes used`);
				} finally {
					// Restore original token
					process.env.UPLOADTHING_TOKEN = originalToken;
				}
			} catch (error) {
				console.warn("Failed to fetch UploadThing usage with UTApi:", error);
				uploadThingUsage = {
					usedBytes: 0,
					fileCount: 0,
				};
			}
		}

		// Fetch Vercel Blob usage if key is available
		if (vercelBlobKey) {
			try {
				// Use Vercel Blob SDK to list all blobs and calculate usage
				const { blobs } = await list({
					limit: 1000, // Get up to 1000 blobs to calculate usage
					token: vercelBlobKey,
				});

				let totalBytes = 0;
				let fileCount = 0;

				for (const blob of blobs) {
					totalBytes += blob.size;
					fileCount++;
				}

				// Vercel Blob also doesn't provide official quota limits via API
				// Only show actual usage without totalBytes field
				vercelBlobUsage = {
					usedBytes: totalBytes,
					fileCount: fileCount,
				};
			} catch (error) {
				console.warn("Failed to fetch Vercel Blob usage:", error);
				vercelBlobUsage = {
					usedBytes: 0,
					fileCount: 0,
				};
			}
		}

		const result: StorageUsageResponse = {
			uploadThing: uploadThingUsage || undefined,
			vercelBlob: vercelBlobUsage || undefined,
			activeProvider,
		};

		return new Response(JSON.stringify(result), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (err: unknown) {
		console.error("Storage usage API error:", err);
		const errorMessage =
			err instanceof Error ? err.message : "Unknown error occurred";

		return new Response(
			JSON.stringify({
				error: "Failed to fetch storage usage",
				details: errorMessage,
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
