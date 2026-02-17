/**
 * Vite configuration for the React + TypeScript frontend.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Export the Vite configuration for the frontend app.
export default defineConfig({
  // Set the frontend folder as the Vite root.
  root: __dirname,

  // Enable React fast refresh and JSX transformations.
  plugins: [react()],

  // Configure dev server proxy to the backend API.
  server: {
    port: 5173,
    proxy: {
      "/reports": "http://localhost:3000",
      "/jobs": "http://localhost:3000",
      "/health": "http://localhost:3000"
    }
  },

  // Build output goes to frontend/dist for production hosting.
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
