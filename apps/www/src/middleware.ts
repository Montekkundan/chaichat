import { clerkMiddleware } from "@clerk/nextjs/server";

// No longer protecting any routes - making login completely optional
export default clerkMiddleware(async (auth, req) => {
	// Everything is public now, no authentication required
	// Users can access all features without logging in
	// Login provides only additional benefits like persistent storage
});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
