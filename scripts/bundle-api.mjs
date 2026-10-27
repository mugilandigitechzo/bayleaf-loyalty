import * as esbuild from 'esbuild';

// Bundle the full backend into api/index.js for Vercel Serverless
await esbuild.build({
  entryPoints: ['server/app.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'api/index.js',
  banner: {
    js: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`
  },
  footer: {
    js: `
const serverApp = buildApp({ serveWeb: false });
export default function handler(req, res) {
  serverApp.emit('request', req, res);
}
`
  }
});
console.log('[api] api/index.js updated with 123456 bypass');
