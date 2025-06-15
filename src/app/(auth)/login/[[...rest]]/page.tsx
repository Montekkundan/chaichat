"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
			<div className="mb-4 text-center">
				<h1 className="mb-2 font-semibold text-2xl tracking-tight">
					Welcome to ChaiChat
				</h1>
				<p className="text-muted-foreground text-sm">Sign in to continue</p>
			</div>

			<SignIn appearance={{ variables: { colorPrimary: "#6366f1" } }} />
		</div>
	);
}
