import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'external-chatterbox-wasm',
    generateBundle(_options, bundle) {
      // shortcut: Sites caps files at 25 MiB; Chatterbox loads its versioned WASM from jsDelivr.
      for (const file of Object.keys(bundle)) {
        if (file.includes('ort-wasm-simd-threaded.asyncify-') && file.endsWith('.wasm')) delete bundle[file];
      }
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['kokoro-js', '@huggingface/transformers', '@hf/transformers-v4'] },
});
