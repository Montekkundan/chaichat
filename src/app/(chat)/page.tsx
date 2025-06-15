import Chat from "~/components/chat/chat";
import { LayoutChat } from "~/components/chat/layout-chat";
import { MessagesProvider } from "~/lib/providers/messages-provider";
import { currentUser } from "@clerk/nextjs/server";

export default async function Page() {
	const user = await currentUser();
	const firstName = user?.firstName || undefined;

	return (
		<LayoutChat>
			<MessagesProvider>
				<Chat initialName={firstName} />
			</MessagesProvider>
		</LayoutChat>
	);
}
