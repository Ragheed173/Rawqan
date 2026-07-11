import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Inlines the entry CSS into index.html at build time (perf).
 *
 * This is a CSR SPA: index.html ships an empty #root, so a critical-CSS
 * extractor would see nothing "used" and defer everything → FOUC. The purged
 * Tailwind entry CSS is small (~38KB raw / ~7KB gzip) and effectively ALL
 * critical, so inlining the whole sheet removes the render-blocking request
 * with zero FOUC and zero visual change. Route-level CSS chunks (admin, etc.)
 * are untouched and still load on demand.
 */
function inlineEntryCss(): Plugin {
  return {
    name: 'inline-entry-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      const bundle = ctx.bundle;
      if (!bundle) return html;
      let out = html;
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== 'asset' || !fileName.endsWith('.css')) continue;
        const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const linkRe = new RegExp(`<link[^>]+rel="stylesheet"[^>]+href="[^"]*${escaped}"[^>]*>`);
        if (linkRe.test(out)) {
          out = out.replace(linkRe, `<style>${asset.source}</style>`);
          // Keep the file in the bundle (lazy chunks list it in their preload
          // deps) but blank it so the follow-up fetch is ~0 bytes, not a
          // duplicate download of the whole sheet.
          asset.source = '';
        }
      }
      return out;
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineEntryCss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Function form: the array form only matched each package's root
        // module, so react-dom/client's implementation (~173KB) leaked into
        // the entry chunk instead of react-vendor.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-router')
          ) {
            return 'react-vendor';
          }
          if (id.includes('/@tanstack/') || id.includes('/axios/')) return 'query-vendor';
          if (id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) {
            return 'motion-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
