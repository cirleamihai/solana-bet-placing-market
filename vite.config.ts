// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from "path";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        nodePolyfills(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
    },
});
