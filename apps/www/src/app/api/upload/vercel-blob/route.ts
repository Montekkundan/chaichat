import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { put } from "@vercel/blob";
import { env } from "~/env";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);



// Run on the Edge for better performance
export const runtime = "edge";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
        const user = await currentUser().catch(() => null);

		// Get user's Vercel Blob API key - try Convex first, then fallback to localStorage
		let vercelBlobKey: string | undefined;
		if (user?.id) {
			try {
				const convexKeys = await convex.action(
					api.userKeys.getUserKeysForAPI,
					{ userId: user.id },
				) as { vercelBlobApiKey?: string };
				if (convexKeys?.vercelBlobApiKey) {
					vercelBlobKey = convexKeys.vercelBlobApiKey;
				}
			} catch (convexError) {
				console.warn(
					"Failed to get Vercel Blob API key from Convex, falling back to localStorage:",
					convexError,
				);
			}
		}

		// Fallback to localStorage keys from request headers if keys not found in Convex
		if (!vercelBlobKey) {
			try {
				// Try to get keys from request headers (passed from client)
				const localKeysHeader = request.headers.get("X-Local-Keys");
				if (localKeysHeader) {
					const localKeys = JSON.parse(localKeysHeader);
					console.log("Local keys from headers:", localKeys);
					if (localKeys.vercelBlobApiKey) {
						vercelBlobKey = localKeys.vercelBlobApiKey;
					}
				}
			} catch (localError) {
				console.warn("Failed to get keys from request headers:", localError);
			}
		}

		if (!vercelBlobKey) {
			return new Response(
				JSON.stringify({ error: "Vercel Blob API key not configured" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		const formData = await request.formData();
		const file = formData.get("file") as File;

		if (!file) {
			return new Response(
				JSON.stringify({ error: "No file provided" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// Validate file type (images only)
		if (!file.type.startsWith("image/")) {
			return new Response(
				JSON.stringify({ error: "Only image files are allowed" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// Validate file size (max 5MB for Vercel Blob)
		if (file.size > 5 * 1024 * 1024) {
			return new Response(
				JSON.stringify({ error: "File size must be less than 5MB" }),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		try {
			// Generate a unique filename
			const timestamp = Date.now();
			const userPrefix = user?.id ? `user-${user.id}` : "anon";
			const filename = `${userPrefix}/${timestamp}-${file.name}`;

			// Upload to Vercel Blob with provided token
			const blob = await put(filename, file, {
				access: "public",
				contentType: file.type,
				token: vercelBlobKey,
			});

			return new Response(
				JSON.stringify({
					success: true,
					file: {
						id: blob.url.split("/").pop() || blob.url,
						url: blob.url,
						name: file.name,
						size: file.size,
						contentType: file.type,
						uploadedAt: new Date().toISOString(),
					},
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		} catch (error) {
			console.error("Vercel Blob upload error:", error);
			return new Response(
				JSON.stringify({
					error: "Failed to upload to Vercel Blob",
					details: error instanceof Error ? error.message : String(error),
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	} catch (err: unknown) {
		console.error("Vercel Blob upload API error:", err);
		const errorMessage =
			err instanceof Error ? err.message : "Unknown error occurred";

		return new Response(
			JSON.stringify({
				error: "Internal server error",
				details: errorMessage,
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
