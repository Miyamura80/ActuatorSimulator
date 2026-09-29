import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The game runs the simulation in the browser (public/sim.wasm, built by
// `make wasm`). `vite` is invoked with this directory as its root (see the
// `dev`/`build` scripts in the repo-root package.json).
//
// `/api` (and `/healthz`) are still proxied to `actsim serve` for debugging
// tools that want the HTTP API. Override the target with `VITE_API_PROXY`.

// @ts-expect-error process is a nodejs global
const apiProxyTarget = process.env.VITE_API_PROXY || "http://127.0.0.1:8080";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	// Don't clear the terminal - keeps `actsim serve` logs visible alongside Vite.
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		proxy: {
			"/api": { target: apiProxyTarget, changeOrigin: true },
			"/healthz": { target: apiProxyTarget, changeOrigin: true },
		},
	},
});
