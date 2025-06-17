import { currentUser } from "@clerk/nextjs/server";
import type { ReactNode } from "react";
import BoardsLayoutClient from "./layout-client";

export default async function BoardsLayout({
	children,
}: { children: ReactNode }) {
	const user = await currentUser();
	const minimalUser = user
		? {
				id: user.id,
				firstName: user.firstName,
				fullName: user.fullName,
				imageUrl: user.imageUrl,
			}
		: undefined;

	return (
		<BoardsLayoutClient initialUser={minimalUser}>{children}</BoardsLayoutClient>
	);
}
