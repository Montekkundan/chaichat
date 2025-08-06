import { currentUser } from "@clerk/nextjs/server";
import Chat from "~/components/chat/chat";
import { LayoutMain } from "~/components/chat/layout-chat";
import { MessagesProvider } from "~/lib/providers/messages-provider";

export default async function Page({
	searchParams,
}: {
	// biome-ignore lint/suspicious/noExplicitAny: searchParams typing varies between Next versions
	searchParams?: any;
}) {
	const user = await currentUser();
	const firstName = user?.firstName || undefined;

	return (
		<LayoutMain>
			<MessagesProvider>
				<Chat initialName={firstName} />
			</MessagesProvider>
		</LayoutMain>
	);
}
