// Bundles the web app with esbuild into dist/web (hashed assets, code-split staff/admin).
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'web');
const watch = process.argv.includes('--watch');
const dev = watch || process.env.NODE_ENV === 'development';

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

const options = {
  entryPoints: [path.join(root, 'web/src/main.tsx')],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: path.join(out, 'assets'),
  entryNames: dev ? '[name]' : '[name]-[hash]',
  chunkNames: '[name]-[hash]',
  assetNames: '[name]-[hash]',
  jsx: 'automatic',
  target: ['es2020'],
  minify: !dev,
  sourcemap: dev ? 'inline' : 'linked',
  metafile: true,
  define: { 'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production') },
  logLevel: 'warning',
  loader: { '.svg': 'text' },
};

function writeHtml(meta) {
  const outputs = Object.entries(meta.outputs);
  const entry = outputs.find(([, o]) => o.entryPoint?.endsWith('main.tsx'));
  const js = '/assets/' + path.basename(entry[0]);
  const css = entry[1].cssBundle ? '/assets/' + path.basename(entry[1].cssBundle) : null;
  let html = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
  html = html.replace('<!--CSS-->', css ? `<link rel="stylesheet" href="${css}">` : '')
             .replace('<!--JS-->', `<script type="module" src="${js}"></script>`);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  for (const f of fs.readdirSync(path.join(root, 'web/public'))) fs.copyFileSync(path.join(root, 'web/public', f), path.join(out, f));
}

if (watch) {
  const ctx = await esbuild.context({ ...options, plugins: [{ name: 'html', setup(b) { b.onEnd((r) => { if (r.metafile) writeHtml(r.metafile); }); } }] });
  await ctx.watch();
  console.log('[web] watching for changes');
} else {
  const result = await esbuild.build(options);
  writeHtml(result.metafile);
  const size = Object.entries(result.metafile.outputs).filter(([f]) => !f.endsWith('.map'))
    .map(([f, o]) => `${path.basename(f)} ${(o.bytes / 1024).toFixed(1)}kB`);
  console.log('[web] built:\n  ' + size.join('\n  '));
}
