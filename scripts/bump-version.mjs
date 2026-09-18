#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const cargoPath = path.join(rootDir, 'backend', 'Cargo.toml');
const pkgPath = path.join(rootDir, 'frontend', 'package.json');
const pkgLockPath = path.join(rootDir, 'frontend', 'package-lock.json');
const releaseNotesPath = path.join(rootDir, 'LATEST_RELEASE.md');

const isForce = process.argv.includes('--force');

// Validação de Governança (.agents/rules/release-governance.md):
// Proibido bump de versão para alterações puramente documentais/regras de IA
function checkReleaseGovernance() {
  try {
    const diffFiles = execSync('git diff --name-only HEAD', { cwd: rootDir, encoding: 'utf8' })
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const untracked = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf8' })
      .split('\n')
      .map(s => s.slice(3).trim())
      .filter(Boolean);

    const changedFiles = Array.from(new Set([...diffFiles, ...untracked]))
      .filter(f => !['package.json', 'package-lock.json', 'Cargo.toml', 'Cargo.lock', 'LATEST_RELEASE.md'].some(ignored => f.endsWith(ignored)));

    if (changedFiles.length > 0) {
      const nonCodePatterns = [
        /^README\.md$/i,
        /^LICENSE$/i,
        /^\.gitignore$/i,
        /^docs\//,
        /^\.agents\//,
        /\.md$/i
      ];

      const isAllNonCode = changedFiles.every(file =>
        nonCodePatterns.some(pattern => pattern.test(file))
      );

      if (isAllNonCode && !isForce) {
        console.error('\n🚨 [GOVERNANÇA BLOQUEADA - .agents/rules/release-governance.md]');
        console.error('As alterações atuais envolvem exclusivamente documentação / regras de agentes:');
        changedFiles.forEach(f => console.error(`  - ${f}`));
        console.error('\nRegra de Ouro: Atualizações de documentação e README NÃO devem gerar nova versão do Saturn nem disparar build de imagens Docker.');
        console.error('Se você realmente deseja forçar o bump de versão, utilize: node scripts/bump-version.mjs <tipo> --force\n');
        process.exit(1);
      }
    }
  } catch {
    // Ignora verificação se o ambiente não possuir git
  }
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Uso: node scripts/bump-version.mjs [patch|minor|major|X.Y.Z] [--force]`);
  console.log(`  patch (pequeno): incrementa o 3º número (X.Y.Z+1)`);
  console.log(`  minor (médio): incrementa o 2º número (X.Y+1.0)`);
  console.log(`  major (muito grande): incrementa o 1º número (X+1.0.0)`);
  console.log(`  --force: ignora a verificação de governança de release caso apenas docs tenham sido alteradas.`);
  process.exit(0);
}

checkReleaseGovernance();

// 1. Read current version from package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '2.0.0';
const [major, minor, patch] = currentVersion.split('.').map(Number);

const nonFlagArgs = process.argv.slice(2).filter(a => !a.startsWith('--'));
const arg = nonFlagArgs[0]?.toLowerCase() || 'patch';

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
  if (/^#\s*Saturn Dashboard\s*v[^\n]+/m.test(releaseNotes)) {
    releaseNotes = releaseNotes.replace(/^#\s*Saturn Dashboard\s*v[^\n]+/m, `# Saturn Dashboard v${newVersion}`);
  } else {
    releaseNotes = `# Saturn Dashboard v${newVersion}\n\n` + releaseNotes;
  }
  fs.writeFileSync(releaseNotesPath, releaseNotes);
}

console.log(`[SemVer] Sucesso! Versão sincronizada para v${newVersion}:`);
console.log(`  ✓ frontend/package.json`);
console.log(`  ✓ frontend/package-lock.json`);
console.log(`  ✓ backend/Cargo.toml`);
console.log(`  ✓ LATEST_RELEASE.md`);
