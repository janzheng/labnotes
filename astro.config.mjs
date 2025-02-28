// @ts-check
import path from "path"
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from "@tailwindcss/vite";
import deno from "@deno/astro-adapter";
import { fileURLToPath } from 'url';

// Get the directory path using ESM compatible approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://astro.build/config
export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  },

  output: "server",
  prefetch: true,
  server: {
    headers: {
      // Add CORS headers for API routes
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  },
  security: {
    checkOrigin: false, // required for lucia auth / cross-site requests
    // checkOrigin: true, // for lucia auth, but no I don't want this (want to be able to login from elsewhere)
    // lucia is handled through valtown auth server and NOT in labsace, bc we want multi-project auth
  },
  integrations: [
    react(),
  ],
  vite: {
    plugins: [
      tailwindcss()
    ]
  },
  adapter: deno({
    start: true,
  })
});