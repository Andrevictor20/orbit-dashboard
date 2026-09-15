import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/locales');

const langCode = process.argv[2]?.toLowerCase()?.trim();
if (!langCode) {
  console.error('Usage: npm run i18n:add <language-code> (e.g., npm run i18n:add de)');
  process.exit(1);
}

const targetDir = path.join(localesDir, langCode);
if (fs.existsSync(targetDir)) {
  console.log(`Language "${langCode}" already exists at ${targetDir}`);
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });

const enDir = path.join(localesDir, 'en');
const domainFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));

for (const file of domainFiles) {
  const src = path.join(enDir, file);
  const dest = path.join(targetDir, file);
  fs.copyFileSync(src, dest);
}

console.log(`\n🎉 Language "${langCode}" successfully created with ${domainFiles.length} domain files!`);
console.log(`Files located at: src/locales/${langCode}/`);
console.log(`Add the language entry to "supportedLanguages" in src/locales/index.ts to enable it in the UI.`);
