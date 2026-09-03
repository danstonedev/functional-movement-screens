#!/usr/bin/env node
/**
 * Turn `npm run build:single` output into a shareable preview fragment.
 *
 * The Artifact host supplies its own <!doctype>/<html>/<head>/<body>, so this strips the
 * document shell and keeps the title, the font link, the styles and the app script. The
 * published preview is then the real built app, not a mock-up of it.
 *
 *   npm run build:single && node scripts/make-preview.mjs [outfile]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('../build/index.html', import.meta.url);
const out = process.argv[2] ?? 'preview.html';
const html = readFileSync(src, 'utf8');

// Search the HEAD only. The inlined app bundle contains `<title>` and `<style>` inside
// string literals, and matching those instead of the real tags produces a broken page.
const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) ?? [, ''])[1];
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) ?? [, ''])[1];
const grab = (src, re) => [...src.matchAll(re)].map((m) => m[0]).join('\n');

const title = (head.match(/<title>[\s\S]*?<\/title>/i) ?? ['<title>Breakout Board</title>'])[0];
const fonts = grab(head, /<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi);
const styles = grab(head, /<style[\s\S]*?<\/style>/gi);

if (!styles) throw new Error('no <style> found in <head> — did build:single run with INLINE=1?');
if (/`|\$\{/.test(title)) throw new Error(`title looks like code, not markup: ${title}`);
if (!body.trim()) throw new Error('empty <body> — build looks wrong');
if (/<script[^>]+\bsrc=/i.test(body)) {
  throw new Error('body still loads an external script; the bundle did not inline');
}

writeFileSync(out, [title, fonts, styles, body.trim(), ''].join('\n'));
console.log(`${out} — ${(readFileSync(out, 'utf8').length / 1024).toFixed(0)} KB`);
