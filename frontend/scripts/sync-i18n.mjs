#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../src/locales');

const ptPath = path.join(LOCALES_DIR, 'pt.ts');
const enPath = path.join(LOCALES_DIR, 'en.ts');

function extractObjectFromTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Remove "export const pt = " or "export const en = " and trailing semicolon
  const cleaned = content
    .replace(/^export\s+const\s+(?:pt|en)\s*=\s*/m, '')
    .replace(/;\s*$/, '');
  
  // Use Function constructor or loose parser to safely evaluate object
  try {
    return new Function(`return (${cleaned});`)();
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err.message);
    process.exit(1);
  }
}

function deepCompareKeys(source, target, prefix = '') {
  const missing = [];
  for (const key of Object.keys(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (!(key in target)) {
      missing.push(fullKey);
    } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof target[key] === 'object' && target[key] !== null) {
        missing.push(...deepCompareKeys(source[key], target[key], fullKey));
      } else {
        missing.push(fullKey);
      }
    }
  }
  return missing;
}

function syncMissingKeys(source, target) {
  let changed = false;
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (!(key in result)) {
      result[key] = source[key];
      changed = true;
    } else if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof result[key] === 'object' && result[key] !== null) {
        const [subResult, subChanged] = syncMissingKeys(source[key], result[key]);
        result[key] = subResult;
        if (subChanged) changed = true;
      } else {
        result[key] = source[key];
        changed = true;
      }
    }
  }

  return [result, changed];
}

function formatTsExport(varName, obj) {
  const jsonStr = JSON.stringify(obj, null, 2);
  return `export const ${varName} = ${jsonStr};\n`;
}

function main() {
  const isCheckMode = process.argv.includes('--check');

  if (!fs.existsSync(ptPath) || !fs.existsSync(enPath)) {
    console.error('Error: pt.ts and en.ts must exist in frontend/src/locales/');
    process.exit(1);
  }

  const pt = extractObjectFromTs(ptPath);
  const en = extractObjectFromTs(enPath);

  const missingInEn = deepCompareKeys(pt, en);
  const missingInPt = deepCompareKeys(en, pt);

  if (isCheckMode) {
    if (missingInEn.length === 0 && missingInPt.length === 0) {
      console.log('✅ i18n Check: pt.ts and en.ts are 100% in sync!');
      process.exit(0);
    } else {
      console.error('❌ i18n Check failed:');
      if (missingInEn.length > 0) {
        console.error(`  Missing in en.ts (${missingInEn.length}):`, missingInEn);
      }
      if (missingInPt.length > 0) {
        console.error(`  Missing in pt.ts (${missingInPt.length}):`, missingInPt);
      }
      process.exit(1);
    }
  }

  // Sync mode
  let [syncedEn, enChanged] = syncMissingKeys(pt, en);
  let [syncedPt, ptChanged] = syncMissingKeys(en, pt);

  if (enChanged) {
    fs.writeFileSync(enPath, formatTsExport('en', syncedEn), 'utf8');
    console.log(`✨ Synchronized en.ts with ${missingInEn.length} new keys from pt.ts.`);
  }

  if (ptChanged) {
    fs.writeFileSync(ptPath, formatTsExport('pt', syncedPt), 'utf8');
    console.log(`✨ Synchronized pt.ts with ${missingInPt.length} new keys from en.ts.`);
  }

  if (!enChanged && !ptChanged) {
    console.log('✅ Locales are already in sync (0 keys missing).');
  }
}

main();
