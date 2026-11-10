import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const appDir = path.join(repoRoot, 'app');
const stylesDir = path.join(appDir, 'styles');
const indexHtmlPath = path.join(appDir, 'index.html');

describe('Step 6 Modular CSS Architecture & Selector Integrity', () => {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const mainCss = fs.readFileSync(path.join(stylesDir, 'main.css'), 'utf8');

  it('removes inline <style> from app/index.html and links ./styles/main.css', () => {
    assert.equal(
      /<style\b/i.test(indexHtml),
      false,
      'app/index.html must not contain <style> tags'
    );
    assert.match(
      indexHtml,
      /<link\s+rel=["']stylesheet["']\s+href=["']\.\/styles\/main\.css["']\s*>/
    );
  });

  it('declares cascade layers in main.css and resolves all @import partials with balanced braces', () => {
    assert.match(
      mainCss,
      /@layer\s+tokens,\s*base,\s*layout,\s*components,\s*features,\s*utilities;/
    );

    const importRegex = /@import\s+url\(['"](.+?)['"]\)\s+layer\(([a-z]+)\);/g;
    const imports = [...mainCss.matchAll(importRegex)];
    assert.equal(imports.length, 15, 'Expected 15 @import layer statements in main.css');

    for (const [, relPath] of imports) {
      const fullPath = path.resolve(stylesDir, relPath);
      assert.ok(fs.existsSync(fullPath), `Missing imported stylesheet: ${relPath}`);
      const content = fs.readFileSync(fullPath, 'utf8').trim();
      assert.ok(content.length > 0, `Empty stylesheet: ${relPath}`);

      // Verify balanced curly braces
      const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
      const openCount = (withoutComments.match(/\{/g) || []).length;
      const closeCount = (withoutComments.match(/\}/g) || []).length;
      assert.equal(openCount, closeCount, `Unbalanced braces in ${relPath}`);
    }
  });

  it('defines CSS rules for all styled classes used in app/index.html static markup', () => {
    const importRegex = /@import\s+url\(['"](.+?)['"]\)/g;
    const allCssText = [...mainCss.matchAll(importRegex)]
      .map(([, relPath]) => fs.readFileSync(path.resolve(stylesDir, relPath), 'utf8'))
      .join('\n');

    // Extract static HTML before <script>
    const htmlBeforeScript = indexHtml.split('<script>')[0];
    const classAttrRegex = /\bclass=["']([^"']+)["']/g;
    const usedClasses = new Set();
    for (const [, classList] of htmlBeforeScript.matchAll(classAttrRegex)) {
      classList
        .split(/\s+/)
        .map((c) => c.trim())
        .filter(Boolean)
        .forEach((c) => usedClasses.add(c));
    }

    // Purely structural/hook classes that intentionally have no standalone rule
    const unstyledHooks = new Set(['google-icon', 'copy-ai-label']);

    for (const cls of usedClasses) {
      if (unstyledHooks.has(cls)) continue;
      const escaped = cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const selectorRegex = new RegExp(`\\.${escaped}(?![a-zA-Z0-9_-])`);
      assert.ok(
        selectorRegex.test(allCssText),
        `Class ".${cls}" used in app/index.html is missing from app/styles/`
      );
    }
  });

  it('eliminates static presentation inline styles from HTML markup', () => {
    const htmlBeforeScript = indexHtml.split('<script>')[0];
    const styleAttrs = [...htmlBeforeScript.matchAll(/\bstyle=["']([^"']+)["']/g)].map((m) => m[1]);

    // Only initial hidden state (`display:none;`) is permitted on JS-toggled elements until Step 9
    for (const styleVal of styleAttrs) {
      assert.equal(
        styleVal.replace(/\s+/g, ''),
        'display:none;',
        `Unexpected presentation inline style in static HTML markup: style="${styleVal}"`
      );
    }
  });
});
