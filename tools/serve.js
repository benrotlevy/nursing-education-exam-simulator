/**
 * Zero-dependency static HTTP development server.
 * Automatically serves `./app` if `./app/index.html` exists (Step 4+),
 * or falls back to the repository root `./` during Steps 2-3.
 *
 * Usage:
 *   node tools/serve.js [--port 4173] [--host 127.0.0.1]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function parseArgs(argv) {
  let port = Number(process.env.PORT) || 4173;
  let host = '127.0.0.1';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (argv[i] === '--host') {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        host = argv[++i];
      } else {
        host = '0.0.0.0';
      }
    }
  }
  return { port, host };
}

export function resolveServeRoot(baseDir = repoRoot) {
  const appDir = path.join(baseDir, 'app');
  if (fs.existsSync(path.join(appDir, 'index.html'))) {
    return appDir;
  }
  return baseDir;
}

export function resolveRequestFilePath(rootDir, rawUrl = '/') {
  const urlObj = new URL(rawUrl, 'http://localhost');
  const decodedPath = decodeURIComponent(urlObj.pathname);
  const relativePath = decodedPath === '/' ? '/index.html' : decodedPath;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    return { status: 403, filePath: null, contentType: 'text/plain; charset=utf-8' };
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return { status: 404, filePath: null, contentType: 'text/plain; charset=utf-8' };
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  return { status: 200, filePath, contentType };
}

export function createStaticServer(rootDir = resolveServeRoot()) {
  return http.createServer((req, res) => {
    try {
      const resolved = resolveRequestFilePath(rootDir, req.url || '/');
      if (resolved.status !== 200 || !resolved.filePath) {
        res.writeHead(resolved.status, { 'Content-Type': resolved.contentType });
        res.end(resolved.status === 403 ? '403 Forbidden' : '404 Not Found');
        return;
      }

      res.writeHead(200, {
        'Content-Type': resolved.contentType,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(resolved.filePath).pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Internal Server Error: ${err.message}`);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { port, host } = parseArgs(process.argv);
  const rootDir = resolveServeRoot();
  const server = createStaticServer(rootDir);
  server.listen(port, host, () => {
    console.log(`Static server listening at http://${host}:${port} (root: ${rootDir})`);
  });
}
