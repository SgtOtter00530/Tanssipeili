// Ajaa kaikki *.e2e.mjs-tiedostot peräkkäin. Valinnainen argumentti rajaa tiedoston nimen osalla.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] || '';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.e2e.mjs') && f.includes(filter)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\ne2e: ${failed}/${files.length} tiedostoa epäonnistui` : `\ne2e: kaikki ${files.length} tiedostoa läpi`);
process.exit(failed ? 1 : 0);
