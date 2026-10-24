import { build } from 'esbuild';
await build({
  entryPoints: ['native/entry.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['chrome90'],
  outfile: 'js/native-bridge.js',
  legalComments: 'none'
});
console.log('js/native-bridge.js gerado');
