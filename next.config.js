/* 
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful 
 * for Docker builds. 
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "utfs.io",
			},
			{
				protocol: "https",
				hostname: "pbs.twimg.com",
			},
		],
	},
	// webpack: (config, { isServer }) => {
	// 	if (!isServer) {
	// 		// Ignore Node.js modules on client-side builds
	// 		config.resolve.fallback = {
	// 			...config.resolve.fallback,
	// 			fs: false,
	// 			net: false,
	// 			child_process: false,
	// 			tls: false,
	// 			crypto: false,
	// 			stream: false,
	// 			url: false,
	// 			zlib: false,
	// 			http: false,
	// 			https: false,
	// 			assert: false,
	// 			os: false,
	// 			path: false,
	// 			util: false,
	// 			querystring: false,
	// 			buffer: false,
	// 		};
	// 	}
	// 	return config;
	// },
};

export default nextConfig;