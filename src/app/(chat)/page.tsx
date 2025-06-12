import Chat from "~/components/chat/chat"
import { LayoutChat } from "~/components/chat/layout-chat"
import { MessagesProvider } from "~/lib/providers/messages-provider"

export default async function Page() {
  return (
	<LayoutChat>
        <MessagesProvider>
            <Chat />
        </MessagesProvider>
	</LayoutChat>
  )
}
