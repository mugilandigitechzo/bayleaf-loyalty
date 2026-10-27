import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['api/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'api/index.js',
  packages: 'bundle',
});
console.log('[api] bundled successfully');
