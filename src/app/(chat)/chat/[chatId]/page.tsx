import Chat from "~/components/chat/chat";
import { LayoutChat } from "~/components/chat/layout-chat";
import { MessagesProvider } from "~/lib/providers/messages-provider";

export default async function Page({
	params,
}: { params: Promise<{ chatId: string }> }) {
	const { chatId } = await params;

	return (
		<LayoutChat>
			<MessagesProvider chatId={chatId}>
				<Chat />
			</MessagesProvider>
		</LayoutChat>
	);
}
