import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function POST(req: Request) {
	try {
		const { urls } = await req.json();
		if (!Array.isArray(urls) || urls.length === 0) {
			return NextResponse.json({ error: "No urls provided" }, { status: 400 });
		}

		// Extract file keys from utfs.io URLs or any uploadthing URL
		const keys = urls
			.map((url: string) => {
				try {
					const u = new URL(url);
					const parts = u.pathname.split("/");
					return parts[parts.length - 1]; // last segment after /f/
				} catch {
					return null;
				}
			})
			.filter(Boolean) as string[];

		if (keys.length === 0) {
			return NextResponse.json({ error: "Invalid urls" }, { status: 400 });
		}

		await utapi.deleteFiles(keys);

		return NextResponse.json({ success: true, deleted: keys.length });
	} catch (err) {
		console.error("delete files error", err);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}
