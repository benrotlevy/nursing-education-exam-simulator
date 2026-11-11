import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findTestFiles, resolveTargetFiles } from '../../tools/test-runner.js';

describe('tools/test-runner.js discovery and category filtering', () => {
  it('discovers all test files when no category is specified and excludes e2e', () => {
    const allTests = resolveTargetFiles();
    assert.ok(allTests.length >= 25, `Expected at least 25 test files, found ${allTests.length}`);
    assert.ok(allTests.every((f) => f.endsWith('.test.js')));
    assert.ok(!allTests.some((f) => f.includes('e2e')));
  });

  it('filters tests strictly by target category', () => {
    const dataTests = resolveTargetFiles('data');
    assert.equal(dataTests.length, 1);
    assert.ok(dataTests[0].includes('questions.schema.test.js'));

    const unitTests = resolveTargetFiles('unit');
    assert.ok(unitTests.length >= 10);
    assert.ok(unitTests.every((f) => f.includes('unit')));

    const domTests = resolveTargetFiles('dom');
    assert.ok(domTests.length >= 5);
    assert.ok(domTests.every((f) => f.includes('dom')));

    const integrationTests = resolveTargetFiles('integration');
    assert.ok(integrationTests.length >= 4);
    assert.ok(integrationTests.every((f) => f.includes('integration')));
  });

  it('handles non-existent or empty directories gracefully', () => {
    const empty = findTestFiles('non-existent-directory-12345');
    assert.deepEqual(empty, []);
  });
});
