// Post-build fix: Astro's auto-generated i18n root redirect concatenates
// `base` + default locale without a slash, producing /ricslineen/ (404).
// Rewrite it to the correct /ricsline/en/ target. Runs as `postbuild`.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(file, 'utf8');
const fixed = html.replaceAll('/ricslineen/', '/ricsline/en/');
if (fixed !== html) {
  writeFileSync(file, fixed);
  console.log('fix-root-redirect: patched dist/index.html -> /ricsline/en/');
} else {
  console.log('fix-root-redirect: nothing to patch');
}
