#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../src/locales');

const isCheckOnly = process.argv.includes('--check');

const enDir = path.join(localesDir, 'en');
if (!fs.existsSync(enDir)) {
  console.error('Base "en" locale directory not found!');
  process.exit(1);
}

const domainFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json')).sort();
const langDirs = fs.readdirSync(localesDir).filter(f => {
  const full = path.join(localesDir, f);
  return fs.statSync(full).isDirectory() && f !== 'en';
}).sort();

console.log(`\n🌐 Saturn i18n Synchronizer`);
console.log(`Found ${domainFiles.length} domain files in canonical "en". Auditing ${langDirs.length} languages...\n`);

let totalMissingAll = 0;
let hasDiscrepancy = false;

for (const lang of langDirs) {
  const targetDir = path.join(localesDir, lang);
  let langMissing = 0;
  let langTotal = 0;

  for (const file of domainFiles) {
    const enFile = path.join(enDir, file);
    const targetFile = path.join(targetDir, file);

    const enData = JSON.parse(fs.readFileSync(enFile, 'utf-8'));
    let targetData = {};
    if (fs.existsSync(targetFile)) {
      try {
        targetData = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
      } catch (e) {
        console.error(`Invalid JSON in ${targetFile}:`, e.message);
      }
    }

    let modified = false;
    for (const [key, val] of Object.entries(enData)) {
      langTotal++;
      if (targetData[key] === undefined) {
        langMissing++;
        if (!isCheckOnly) {
          targetData[key] = val; // fallback to en
          modified = true;
        }
      }
    }

    if (modified && !isCheckOnly) {
      fs.writeFileSync(targetFile, JSON.stringify(targetData, null, 2) + '\n', 'utf-8');
    }
  }

  totalMissingAll += langMissing;
  const coverage = Math.round(((langTotal - langMissing) / langTotal) * 100);
  const statusIcon = langMissing === 0 ? '✅' : isCheckOnly ? '⚠️' : '🔄';
  console.log(`${statusIcon} ${lang.toUpperCase().padEnd(6)}: ${coverage}% translated (${langMissing} missing keys${isCheckOnly ? ' detected' : ' filled with fallback'})`);
  if (langMissing > 0) hasDiscrepancy = true;
}

if (isCheckOnly && hasDiscrepancy) {
  console.log(`\n❌ i18n Check failed: ${totalMissingAll} missing translations across languages. Run "npm run i18n:sync" to synchronize.`);
  process.exit(1);
} else {
  console.log(`\n✨ All ${langDirs.length + 1} languages audited successfully! Total missing keys: ${totalMissingAll}\n`);
}
