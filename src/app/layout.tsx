import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "~/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import ConvexClientProvider from "~/components/providers/convex-client-provider";
import { ErrorBoundary } from "~/components/providers/error-boundary";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { ThemeScript } from "~/components/theme-script";
import { Toaster } from "~/components/ui/sonner";
import { UserSessionHandler } from "~/components/user-session-handler";
import { APP_DESCRIPTION, APP_NAME, APP_URL, generateOGImageURL } from "~/lib/config";
import { CacheProvider } from "~/lib/providers/cache-provider";
import { ChatsProvider } from "~/lib/providers/chats-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: APP_NAME,
	description: APP_DESCRIPTION,
	icons: [{ rel: "icon", url: "/favicon.ico" }],
	openGraph: {
		title: APP_NAME,
		description: APP_DESCRIPTION,
		url: APP_URL,
		type: "website",
		images: [
			{
				url: generateOGImageURL({
					title: APP_NAME,
					type: 'default',
					description: APP_DESCRIPTION,
				}),
				width: 1200,
				height: 630,
				alt: APP_NAME,
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: APP_NAME,
		description: APP_DESCRIPTION,
		images: [generateOGImageURL({
			title: APP_NAME,
			type: 'default',
			description: APP_DESCRIPTION,
		})],
	},
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const cookieStore = await cookies();

	type BasicChat = {
		_id: string;
		name: string;
		userId: string;
		currentModel: string;
		initialModel: string;
		createdAt: number;
		_creationTime: number;
		isPublic: boolean;
	};

	let initialChats: BasicChat[] = [];
	const chatsCookie = cookieStore.get("cc_chats")?.value;
	if (chatsCookie) {
		try {
			const parsed = JSON.parse(decodeURIComponent(chatsCookie));
			if (Array.isArray(parsed)) {
				initialChats = parsed.map((c): BasicChat => {
					const obj = c as { _id: string; name: string; currentModel?: string };
					return {
						_id: obj._id,
						name: obj.name,
						userId: "",
						currentModel: obj.currentModel ?? "",
						initialModel: obj.currentModel ?? "",
						createdAt: 0,
						_creationTime: 0,
						isPublic: false,
					};
				});
			}
		} catch {
			// ignore parse errors
		}
	}

	return (
		<ClerkProvider>
			<html
				lang="en"
				className={`${inter.className} antialiased`}
				suppressHydrationWarning
			>
				<head>
					<ThemeScript />
				</head>
				<body className="bg-sidebar">
					<ErrorBoundary>
						<ThemeProvider
							attribute="class"
							defaultTheme="system"
							enableSystem
							disableTransitionOnChange
						>
							<ConvexClientProvider>
								<CacheProvider initialChats={initialChats}>
									<ChatsProvider>
										<UserSessionHandler />
										<Toaster position="top-center" />
										{children}
										<Analytics />
									</ChatsProvider>
								</CacheProvider>
							</ConvexClientProvider>
						</ThemeProvider>
					</ErrorBoundary>
				</body>
			</html>
		</ClerkProvider>
	);
}
