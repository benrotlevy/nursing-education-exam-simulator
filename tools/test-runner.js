import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

/**
 * Recursively discovers all *.test.js files within a directory, ignoring e2e specs.
 * @param {string} dir
 * @returns {string[]}
 */
export function findTestFiles(dir) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'e2e') {
          files.push(...findTestFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.push(fullPath);
      }
    }
    return files;
  } catch {
    return [];
  }
}

/**
 * Resolves test files for a given category (or all tests if empty).
 * @param {string} [category]
 * @param {string} [baseDir=repoRoot]
 * @returns {string[]}
 */
export function resolveTargetFiles(category, baseDir = repoRoot) {
  const targetDir = category ? path.join(baseDir, 'tests', category) : path.join(baseDir, 'tests');
  return findTestFiles(targetDir);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const category = process.argv[2];
  const testFiles = resolveTargetFiles(category);

  if (testFiles.length === 0) {
    console.error(`[test-runner] No test files found for target: ${category || 'all'}`);
    process.exit(1);
  }

  const child = spawn(process.execPath, ['--test', ...testFiles], {
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });
}
