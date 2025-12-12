"use client";
import { LayoutMain } from "~/components/chat/layout-chat";
import { Playground } from "~/components/playground/playground";
import { PlaygroundProvider } from "~/lib/providers/playground-provider";

export default function PlaygroundPage() {
	return (
		<LayoutMain>
			<PlaygroundProvider>
				<Playground />
			</PlaygroundProvider>
		</LayoutMain>
	);
}
