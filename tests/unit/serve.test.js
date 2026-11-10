import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveServeRoot, resolveRequestFilePath } from '../../tools/serve.js';

describe('tools/serve.js static dev server resolution', () => {
  it('resolves "/" to index.html with 200 OK and text/html content-type', () => {
    const rootDir = resolveServeRoot();
    const res = resolveRequestFilePath(rootDir, '/');
    assert.equal(res.status, 200);
    assert.equal(res.contentType, 'text/html; charset=utf-8');
    assert.ok(res.filePath && fs.existsSync(res.filePath));
  });

  it('returns 404 for non-existent paths and prevents directory traversal', () => {
    const rootDir = resolveServeRoot();
    const notFound = resolveRequestFilePath(rootDir, '/does-not-exist.html');
    assert.equal(notFound.status, 404);

    const traversal = resolveRequestFilePath(rootDir, '/../../../../etc/passwd');
    assert.equal(traversal.status, 404);
  });
});
