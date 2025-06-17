import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;

		const client = await clerkClient();
		const user = await client.users.getUser(id);

		return NextResponse.json({
			id: user.id,
			fullName: user.fullName,
			imageUrl: user.imageUrl,
		});
	} catch {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}
}
