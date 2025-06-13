"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-4 text-center">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Welcome to ChaiChat</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue</p>
      </div>

      <SignIn appearance={{ variables: { colorPrimary: "#6366f1" } }} />
    </div>
  );
}
