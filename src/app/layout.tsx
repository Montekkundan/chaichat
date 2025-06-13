import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ConvexClientProvider from "~/components/providers/convex-client-provider";
import { ThemeProvider } from "~/components/providers/theme-provider";
import { Toaster } from "~/components/ui/sonner";
import { CacheProvider } from "~/lib/providers/cache-provider";
import { ChatsProvider } from "~/lib/providers/chats-provider";
import { ModelsProvider } from "~/lib/providers/models-provider";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ChaiChat",
	description: "AI-powered chat application",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<ClerkProvider>
			<html
				lang="en"
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
				suppressHydrationWarning
			>
				<body className="bg-sidebar">
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						<ConvexClientProvider>
							<CacheProvider>
								<ChatsProvider>
									<ModelsProvider>
										<main className="flex-1">
											<Toaster position="top-center" />
											{children}
										</main>
									</ModelsProvider>
								</ChatsProvider>
							</CacheProvider>
						</ConvexClientProvider>
					</ThemeProvider>
				</body>
			</html>
		</ClerkProvider>
	);
}
