"use client";

// This catch-all route is required by Clerk so that any sub-path under /login
// (e.g. /login/ˍˍclerk_callback) is handled without a 404.
// It simply re-exports the existing LoginPage component.

import LoginPage from "../page";
export default LoginPage; 