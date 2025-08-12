"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { userSessionManager } from "~/lib/user-session-manager";

export function UserSessionHandler() {
	const { user, isLoaded } = useUser();

	useEffect(() => {
		if (!isLoaded) return;

		if (user?.id) {
			// User is logged in - handle login sync
			userSessionManager.handleUserLogin(user.id);
		} else {
			// User is logged out - handle logout
			userSessionManager.handleUserLogout();
		}
	}, [user?.id, isLoaded]);

	// This component doesn't render anything
	return null;
}
