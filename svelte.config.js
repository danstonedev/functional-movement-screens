import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** `INLINE=1 npm run build:single` emits one self-contained HTML file, which is what
 *  gets published as the shareable preview. A normal build is a regular static site. */
const inline = !!process.env.INLINE;

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Single route, fully client-rendered: an SPA fallback serves it from any path.
    adapter: adapter({ fallback: 'index.html', precompress: false }),
    output: inline ? { bundleStrategy: 'inline' } : {},
    // A single-file build is opened from an arbitrary path (an artifact host, a file:// URL),
    // and the default router matches on location.pathname, so it would 404 on itself.
    router: inline ? { type: 'hash' } : { type: 'pathname' },
  },
};
