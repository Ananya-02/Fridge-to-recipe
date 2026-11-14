import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, forward /api calls to the Express server so the browser never sees the API key.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:8787' } } });
