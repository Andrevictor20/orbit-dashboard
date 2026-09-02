#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const cargoPath = path.join(rootDir, 'backend', 'Cargo.toml');
const pkgPath = path.join(rootDir, 'frontend', 'package.json');
const pkgLockPath = path.join(rootDir, 'frontend', 'package-lock.json');
const releaseNotesPath = path.join(rootDir, 'LATEST_RELEASE.md');

// 1. Read current version from package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '2.0.0';
const [major, minor, patch] = currentVersion.split('.').map(Number);

const arg = process.argv[2]?.toLowerCase() || 'patch';

let newVersion;

if (/^\d+\.\d+\.\d+$/.test(arg)) {
  // Versão explícita informada (ex: 2.1.0)
  newVersion = arg;
} else if (arg === 'major' || arg === 'grande' || arg === 'muito-grande') {
  // Alteração muito grande: incrementa o 1º número (X.0.0)
  newVersion = `${major + 1}.0.0`;
} else if (arg === 'minor' || arg === 'medio' || arg === 'médio') {
  // Alteração média: incrementa o 2º número (X.Y.0)
  newVersion = `${major}.${minor + 1}.0`;
} else if (arg === 'patch' || arg === 'pequeno') {
  // Alteração pequena: incrementa o 3º número (X.Y.Z)
  newVersion = `${major}.${minor}.${patch + 1}`;
} else {
  console.error(`Uso: node scripts/bump-version.mjs [patch|minor|major|X.Y.Z]`);
  console.error(`  patch (pequeno): incrementa o 3º número (${major}.${minor}.${patch + 1})`);
  console.error(`  minor (médio): incrementa o 2º número (${major}.${minor + 1}.0)`);
  console.error(`  major (muito grande): incrementa o 1º número (${major + 1}.0.0)`);
  process.exit(1);
}

console.log(`[SemVer] Atualizando versão: ${currentVersion} -> ${newVersion}`);

// 2. Atualizar frontend/package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 3. Atualizar frontend/package-lock.json
if (fs.existsSync(pkgLockPath)) {
  try {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLock.version = newVersion;
    if (pkgLock.packages && pkgLock.packages['']) {
      pkgLock.packages[''].version = newVersion;
    }
    fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n');
  } catch (err) {
    console.warn('[SemVer] Aviso: Não foi possível atualizar package-lock.json:', err.message);
  }
}

// 4. Atualizar backend/Cargo.toml
if (fs.existsSync(cargoPath)) {
  let cargoContent = fs.readFileSync(cargoPath, 'utf8');
  cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoPath, cargoContent);
}

// 5. Atualizar título em LATEST_RELEASE.md
if (fs.existsSync(releaseNotesPath)) {
  let releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');
  if (/^#\s*Orbit Dashboard\s*v[^\n]+/m.test(releaseNotes)) {
    releaseNotes = releaseNotes.replace(/^#\s*Orbit Dashboard\s*v[^\n]+/m, `# Orbit Dashboard v${newVersion}`);
  } else {
    releaseNotes = `# Orbit Dashboard v${newVersion}\n\n` + releaseNotes;
  }
  fs.writeFileSync(releaseNotesPath, releaseNotes);
}

console.log(`[SemVer] Sucesso! Versão sincronizada para v${newVersion}:`);
console.log(`  ✓ frontend/package.json`);
console.log(`  ✓ frontend/package-lock.json`);
console.log(`  ✓ backend/Cargo.toml`);
console.log(`  ✓ LATEST_RELEASE.md`);
