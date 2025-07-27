import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "~/styles/globals.css";
import "~/styles/themes.css";
import ConvexClientProvider from "~/components/providers/convex-client-provider";
import { ErrorBoundary } from "~/components/providers/error-boundary";
import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { DEFAULT_APP_THEME, APP_NAME, APP_DESCRIPTION, APP_URL, APP_OG_IMAGE } from "~/lib/config";
import { ActiveThemeProvider } from "~/components/active-theme";
import { CacheProvider } from "~/lib/providers/cache-provider";
import { ChatsProvider } from "~/lib/providers/chats-provider";
import { ModelsProvider } from "~/lib/providers/models-provider";
import { QuotaProvider } from "~/lib/providers/quota-provider";
import { Analytics } from "@vercel/analytics/react";
import { UserSessionHandler } from "~/components/user-session-handler";

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
				url: `${APP_URL}${APP_OG_IMAGE}`,
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
		images: [`${APP_URL}${APP_OG_IMAGE}`],
	},
};

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const cookieStore = await cookies();
	const activeThemeValue = cookieStore.get("active_theme")?.value;

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
				<body
					className={`bg-sidebar theme-${activeThemeValue ?? DEFAULT_APP_THEME}`}
				>
					<ErrorBoundary>
						<ThemeProvider
							attribute="class"
							defaultTheme="system"
							enableSystem
							disableTransitionOnChange
						>
							<ActiveThemeProvider initialTheme={activeThemeValue}>
								<ConvexClientProvider>
									<CacheProvider initialChats={initialChats}>
										<ChatsProvider>
											<ModelsProvider>
												<QuotaProvider>
													<UserSessionHandler />
													<Toaster position="top-center" />
													{children}
													<Analytics />
												</QuotaProvider>
											</ModelsProvider>
										</ChatsProvider>
									</CacheProvider>
								</ConvexClientProvider>
							</ActiveThemeProvider>
						</ThemeProvider>
					</ErrorBoundary>
				</body>
			</html>
		</ClerkProvider>
	);
}
