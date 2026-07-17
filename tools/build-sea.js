#!/usr/bin/env node
/**
 * Build a standalone verdict.exe from verdict.mjs
 *
 * Strategy:
 *   1. Bundle the ESM source into a single CJS file via esbuild
 *   2. Generate a Node.js SEA blob from the bundled file
 *   3. Inject the blob into a copy of the Node.js binary
 *   4. Compute the SHA-256 checksum
 *
 * Output:
 *   dist/verdict.exe         standalone executable (~40–45 MB)
 *   dist/verdict.exe.sha256  SHA-256 checksum file
 *
 * Prerequisites (all resolved automatically via npx):
 *   - esbuild
 *   - postject
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    copyFileSync, existsSync, mkdirSync,
    readFileSync, unlinkSync, statSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = resolve(DIR, '..');
const CLI_DIR = join(ROOT, 'tools', 'verdict-cli');
const DIST_DIR = join(ROOT, 'dist');
const ENTRY_MJS = join(CLI_DIR, 'verdict.mjs');
const BUNDLED_CJS = join(DIST_DIR, 'verdict-bundled.cjs');
const SEA_CONFIG = join(DIST_DIR, 'sea-config-bundle.json');
const SEA_BLOB = join(DIST_DIR, 'sea-prep-bundle.blob');
const OUTPUT_EXE = join(DIST_DIR, 'verdict.exe');
const MANIFEST = join(DIST_DIR, 'verdict.exe.sha256');

// ── Detect correct sentinel fuse string ─────────────────────────────
function detectSentinel(nodePath) {
    const buf = readFileSync(nodePath);
    const idx = buf.indexOf('NODE_SEA_FUSE');
    if (idx < 0) return null;
    let end = idx;
    while (end < buf.length && buf[end] !== 0 && buf[end] !== 58) end++;
    return buf.slice(idx, end).toString();
}

// ── Main ────────────────────────────────────────────────────────────
if (!existsSync(ENTRY_MJS)) {
    console.error(`❌ Entry script not found: ${ENTRY_MJS}`);
    process.exit(1);
}
const nodeExe = process.execPath;
const sentinel = detectSentinel(nodeExe);
if (!sentinel) {
    console.error('❌ NODE_SEA_FUSE sentinel not found in Node.js binary');
    console.error('   This Node.js build does not support Single Executable Applications.');
    process.exit(1);
}

mkdirSync(DIST_DIR, { recursive: true });

// Step 1 – Bundle ESM → CJS via esbuild
console.log('🔧 Bundling ESM to CJS via esbuild...');
execSync(
    `npx --yes esbuild "${ENTRY_MJS}" --bundle --platform=node --target=node22 `
    + `--outfile="${BUNDLED_CJS}"`,
    { stdio: 'inherit', timeout: 60_000, shell: true },
);
if (!existsSync(BUNDLED_CJS)) {
    console.error('❌ esbuild bundle failed');
    process.exit(1);
}

// Step 2 – Generate SEA blob
console.log('📦 Generating SEA preparation blob...');
writeFileSync(SEA_CONFIG, JSON.stringify({
    main: 'verdict-bundled.cjs',
    output: 'sea-prep-bundle.blob',
    disableExperimentalSEAWarning: true,
}, null, 2));

execSync(
    `node --experimental-sea-config "${SEA_CONFIG}"`,
    { cwd: DIST_DIR, stdio: 'inherit', timeout: 30_000 },
);
if (!existsSync(SEA_BLOB)) {
    console.error('❌ SEA blob was not generated');
    process.exit(1);
}

// Step 3 – Copy Node binary and inject blob
console.log('📋 Copying Node binary...');
copyFileSync(nodeExe, OUTPUT_EXE);
const exeStat = statSync(OUTPUT_EXE);
if (exeStat.size === 0) {
    console.error('❌ Failed to copy Node binary');
    process.exit(1);
}

console.log('💉 Injecting SEA blob into verdict.exe...');
execSync(
    `node node_modules/postject/dist/cli.js "${OUTPUT_EXE}" NODE_SEA_BLOB `
    + `"${SEA_BLOB}" --sentinel-fuse "${sentinel}" --macho-segment-name NODE_SEA`,
    { stdio: 'inherit', timeout: 120_000, shell: true },
);

// Step 4 – Compute SHA-256
console.log('🔐 Computing SHA-256...');
const exeBuffer = readFileSync(OUTPUT_EXE);
const sha256 = createHash('sha256').update(exeBuffer).digest('hex');
writeFileSync(MANIFEST, `${sha256}  verdict.exe\n`);
console.log(`   SHA-256: ${sha256}`);

// Step 5 – Cleanup intermediate artifacts
for (const file of [BUNDLED_CJS, SEA_CONFIG, SEA_BLOB]) {
    try { unlinkSync(file); } catch { /* ignore */ }
}

const sizeMb = (statSync(OUTPUT_EXE).size / (1024 * 1024)).toFixed(1);
console.log(`\n✅ verdict.exe built at ${OUTPUT_EXE} (${sizeMb} MB)`);
