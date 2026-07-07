import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..", "..");
const sourceStatic = resolve(repoRoot, "back", "src", "main", "resources", "static");
const targetStatic = resolve(repoRoot, "target", "classes", "static");

if (!existsSync(sourceStatic)) {
  console.log(`[sync-static] source does not exist: ${sourceStatic}`);
  process.exit(0);
}

mkdirSync(dirname(targetStatic), { recursive: true });

if (existsSync(targetStatic)) {
  rmSync(targetStatic, { recursive: true, force: true });
}

cpSync(sourceStatic, targetStatic, { recursive: true });
console.log(`[sync-static] copied ${sourceStatic} -> ${targetStatic}`);
