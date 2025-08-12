import type { Metadata } from "next";
import { APP_NAME, generateOGImageURL } from "~/lib/config";

export const metadata: Metadata = {
	title: `Registry - ${APP_NAME}`,
	description:
		"Custom component registry for distributing code using shadcn. Browse and explore reusable components.",
	openGraph: {
		title: `Registry - ${APP_NAME}`,
		description:
			"Custom component registry for distributing code using shadcn. Browse and explore reusable components.",
		images: [
			{
				url: generateOGImageURL({
					title: "Registry",
					type: "registry",
				}),
				width: 1200,
				height: 630,
				alt: "Registry - ChaiChat",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: `Registry - ${APP_NAME}`,
		description:
			"Custom component registry for distributing code using shadcn. Browse and explore reusable components.",
		images: [
			generateOGImageURL({
				title: "Registry",
				type: "registry",
			}),
		],
	},
};

export default function RegistryLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return children;
}
