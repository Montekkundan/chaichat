"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { userSessionManager } from "~/lib/user-session-manager";

export function UserSessionHandler() {
	const { user, isLoaded } = useUser();

	useEffect(() => {
		if (!isLoaded) return;

		if (user?.id) {
			userSessionManager.handleUserLogin(user.id);
		} else {
			userSessionManager.handleUserLogout();
		}
	}, [user?.id, isLoaded]);

	return null;
}
