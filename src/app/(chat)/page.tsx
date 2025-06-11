import Chat from "~/components/chat/chat"
import { LayoutChat } from "~/components/chat/layout-chat"

export default async function Page() {
  return (
	<LayoutChat>
        <Chat />
	</LayoutChat>
  )
}
