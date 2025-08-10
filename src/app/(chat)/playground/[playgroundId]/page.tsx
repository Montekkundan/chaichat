import type { Metadata } from "next";
import { LayoutMain } from "~/components/chat/layout-chat";
import { Playground } from "~/components/playground/playground";
import { APP_NAME, generateOGImageURL } from "~/lib/config";
import { PlaygroundProvider } from "~/lib/providers/playground-provider";

export const metadata: Metadata = {
	title: `Playground - ${APP_NAME}`,
	description:
		"Experiment with AI models in a flexible playground environment. Test different parameters and configurations.",
	openGraph: {
		title: `Playground - ${APP_NAME}`,
		description:
			"Experiment with AI models in a flexible playground environment. Test different parameters and configurations.",
		images: [
			{
				url: generateOGImageURL({
					title: "Playground",
					type: "playground",
				}),
				width: 1200,
				height: 630,
				alt: "Playground - ChaiChat",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `Playground - ${APP_NAME}`,
		description:
			"Experiment with AI models in a flexible playground environment. Test different parameters and configurations.",
		images: [
			generateOGImageURL({
				title: "Playground",
				type: "playground",
			}),
		],
	},
};

export default async function PlaygroundPage({
	params,
}: { params: Promise<{ playgroundId: string }> }) {
	const { playgroundId } = await params;
	return (
		<LayoutMain>
			<PlaygroundProvider playgroundId={playgroundId}>
				<Playground />
			</PlaygroundProvider>
		</LayoutMain>
	);
}
