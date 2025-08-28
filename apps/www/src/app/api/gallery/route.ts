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
export const revalidate = 60; // Cache for 1 minute

const convex = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);



type LocalKeys = {
	llmGatewayApiKey?: string;
	aiGatewayApiKey?: string;
	uploadThingApiKey?: string;
	vercelBlobApiKey?: string;
	storageProvider?: "uploadthing" | "vercelblob";
};

type GalleryImage = {
	id: string;
	url: string;
	name: string;
	size: number;
	contentType: string;
	uploadedAt: string;
	generated?: boolean;
	prompt?: string;
};

type GalleryResponse = {
	images: GalleryImage[];
	totalCount: number;
	hasMore: boolean;
};

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const limit = Math.min(Number.parseInt(searchParams.get("limit") || "20"), 50);
		const offset = Number.parseInt(searchParams.get("offset") || "0");

		let uploadThingKey: string | undefined;
		let vercelBlobKey: string | undefined;
		let storageProvider: "uploadthing" | "vercelblob" = "uploadthing";

		// Get user API keys - try Convex first, then fallback to localStorage
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

		if (!uploadThingKey || !vercelBlobKey || storageProvider === "uploadthing") {
			try {
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

		const images: GalleryImage[] = [];

		if (storageProvider === "uploadthing" && uploadThingKey) {
			try {
					const utapi = new UTApi();

					const filesResponse = await utapi.listFiles();

					const files = filesResponse.files.slice(offset, offset + limit);

					console.log("UploadThing file sample:", JSON.stringify(files[0], null, 2));

					for (const file of files) {
						// Convert Unix timestamp (milliseconds) to ISO string
						const uploadedAt = new Date(file.uploadedAt).toISOString();

						// Construct URL using the file key
						const imageUrl = `https://utfs.io/f/${file.key}`;

						const ext = file.name.toLowerCase().split('.').pop();
						let contentType = "image/jpeg";
						switch (ext) {
							case 'png': contentType = "image/png"; break;
							case 'webp': contentType = "image/webp"; break;
							case 'gif': contentType = "image/gif"; break;
							case 'svg': contentType = "image/svg+xml"; break;
							case 'jpg':
							case 'jpeg': break;
						}

						console.log(`Processing file: ${file.name}, URL: ${imageUrl}`);

						images.push({
							id: file.key,
							url: imageUrl,
							name: file.name,
							size: file.size,
							contentType: contentType,
							uploadedAt: uploadedAt,
							generated: false,
						});
					}
			} catch (error) {
				console.warn("Failed to fetch UploadThing files with UTApi:", error);
			}
		}

		// Fetch from Vercel Blob if using Vercel Blob and key is available
		if (storageProvider === "vercelblob" && vercelBlobKey) {
			try {
				// Set the BLOB_READ_WRITE_TOKEN environment variable for Vercel Blob
				process.env.BLOB_READ_WRITE_TOKEN = vercelBlobKey;

				// Use Vercel Blob SDK to list blobs
				const { blobs } = await list({
					limit: limit,
				});

				for (const blob of blobs) {
					images.push({
						id: blob.url.split('/').pop() || blob.url,
						url: blob.url,
						name: blob.pathname,
						size: blob.size,
						contentType: "application/octet-stream",
						uploadedAt: blob.uploadedAt.toISOString(),
						generated: false,
					});
				}
			} catch (error) {
				console.warn("Failed to fetch Vercel Blob files:", error);
			}
		}

		// Sort images by upload date (newest first)
		images.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

		const result: GalleryResponse = {
			images,
			totalCount: images.length,
			hasMore: images.length >= limit,
		};

		return new Response(JSON.stringify(result), {
			headers: { "Content-Type": "application/json" },
		});
	} catch (err: unknown) {
		console.error("Gallery API error:", err);
		const errorMessage =
			err instanceof Error ? err.message : "Unknown error occurred";

		return new Response(
			JSON.stringify({
				error: "Failed to fetch gallery images",
				details: errorMessage,
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}
