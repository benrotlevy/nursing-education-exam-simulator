import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const RULES_PATH = path.join(ROOT_DIR, 'firestore.rules');

/**
 * Pure Node.js compiler & evaluator for Cloud Firestore Security Rules.
 * Reads production firestore.rules and interprets security logic against request/resource contexts.
 */
function compileFirestoreRules(rulesSource) {
  // 1. Strip line comments
  const lines = rulesSource
    .split('\n')
    .map((l) => {
      const idx = l.indexOf('//');
      return idx >= 0 ? l.slice(0, idx) : l;
    })
    .join('\n');

  // 2. Extract balanced brace blocks (match, function)
  function extractBlocks(src) {
    let pos = 0;
    function skipWhitespace() {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
    }
    const tokens = [];
    while (pos < src.length) {
      skipWhitespace();
      if (pos >= src.length) break;
      if (src.startsWith('match', pos) && /\s/.test(src[pos + 5])) {
        pos += 5;
        skipWhitespace();
        const pathStart = pos;
        let pathBrace = 0;
        while (pos < src.length) {
          if (src[pos] === '{') {
            if (pathBrace === 0 && pos > pathStart && /\s/.test(src[pos - 1])) {
              break;
            }
            pathBrace++;
          } else if (src[pos] === '}') {
            pathBrace--;
          }
          pos++;
        }
        const blockPath = src.slice(pathStart, pos).trim();
        pos++; // skip opening '{'
        let depth = 1;
        const bodyStart = pos;
        while (pos < src.length && depth > 0) {
          if (src[pos] === '{') depth++;
          else if (src[pos] === '}') depth--;
          pos++;
        }
        const body = src.slice(bodyStart, pos - 1);
        tokens.push({ type: 'match', path: blockPath, body });
      } else if (src.startsWith('function', pos) && /\s/.test(src[pos + 8])) {
        pos += 8;
        skipWhitespace();
        const nameStart = pos;
        while (pos < src.length && src[pos] !== '(') pos++;
        const name = src.slice(nameStart, pos).trim();
        pos++; // skip '('
        const paramStart = pos;
        while (pos < src.length && src[pos] !== ')') pos++;
        const params = src
          .slice(paramStart, pos)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        pos++; // skip ')'
        skipWhitespace();
        if (src[pos] === '{') {
          pos++;
          let depth = 1;
          const bodyStart = pos;
          while (pos < src.length && depth > 0) {
            if (src[pos] === '{') depth++;
            else if (src[pos] === '}') depth--;
            pos++;
          }
          const body = src.slice(bodyStart, pos - 1);
          tokens.push({ type: 'function', name, params, body });
        }
      } else {
        pos++;
      }
    }
    return tokens;
  }

  // 3. Transpile CEL / Rules expression operators to JavaScript
  function transformExpression(expr) {
    let res = expr;
    // Replace 'expr is type' -> '__is(expr, "type")'
    res = res.replace(/([a-zA-Z0-9_.[\]]+)\s+is\s+([a-zA-Z]+)/g, '__is($1, "$2")');
    // Replace 'obj.keys().hasAll(' -> '__hasAll(obj, '
    res = res.replace(/([a-zA-Z0-9_.[\]]+)\.keys\(\)\.hasAll\(/g, '__hasAll($1, ');
    // Replace 'obj.keys().hasOnly(' -> '__hasOnly(obj, '
    res = res.replace(/([a-zA-Z0-9_.[\]]+)\.keys\(\)\.hasOnly\(/g, '__hasOnly($1, ');
    // Replace 'expr.size()' -> '__size(expr)'
    res = res.replace(/([a-zA-Z0-9_.[\]]+)\.size\(\)/g, '__size($1)');
    return res;
  }

  const topBlocks = extractBlocks(lines);
  const docMatch = topBlocks.find((b) => b.type === 'match');
  if (!docMatch) {
    throw new Error('No match block found for documents root');
  }

  const innerTokens = extractBlocks(docMatch.body);
  const functions = innerTokens.filter((t) => t.type === 'function');
  const matchBlocks = innerTokens.filter((t) => t.type === 'match');

  function parseAllowRules(blockBody) {
    const allowRegex = /allow\s+([^:]+):\s*if\s+([^;]+);/g;
    let m;
    const rules = [];
    while ((m = allowRegex.exec(blockBody)) !== null) {
      const ops = m[1].split(',').map((s) => s.trim().toLowerCase());
      const condition = m[2].trim();
      rules.push({ ops, condition: transformExpression(condition) });
    }
    return rules;
  }

  for (const mb of matchBlocks) {
    mb.allowRules = parseAllowRules(mb.body);
  }

  const fnSourceParts = [];
  for (const fn of functions) {
    let body = fn.body.trim();
    if (body.startsWith('return')) {
      body = body.slice(6).trim();
    }
    if (body.endsWith(';')) {
      body = body.slice(0, -1).trim();
    }
    body = transformExpression(body);
    fnSourceParts.push(`function ${fn.name}(${fn.params.join(', ')}) { return (${body}); }`);
  }

  const code = `
    return function evaluate({ request, resource, path, operation }) {
      function __is(val, type) {
        if (val === undefined || val === null) return false;
        switch (type) {
          case 'int': return Number.isInteger(val);
          case 'float': return typeof val === 'number' && !Number.isNaN(val);
          case 'number': return typeof val === 'number' && !Number.isNaN(val);
          case 'string': return typeof val === 'string';
          case 'bool': return typeof val === 'boolean';
          case 'list': return Array.isArray(val);
          case 'map': return typeof val === 'object' && val !== null && !Array.isArray(val);
          case 'timestamp': return val instanceof Date || (typeof val === 'object' && val !== null && typeof val.seconds === 'number');
          default: return false;
        }
      }

      function __size(val) {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'string' || Array.isArray(val)) return val.length;
        if (typeof val === 'object') return Object.keys(val).length;
        return 0;
      }

      function __hasAll(obj, required) {
        if (!obj || typeof obj !== 'object') return false;
        const keys = Object.keys(obj);
        return Array.isArray(required) && required.every((f) => keys.includes(f));
      }

      function __hasOnly(obj, allowed) {
        if (!obj || typeof obj !== 'object') return false;
        const keys = Object.keys(obj);
        return Array.isArray(allowed) && keys.every((k) => allowed.includes(k));
      }

      request = request || {};
      resource = resource || { data: {} };

      ${fnSourceParts.join('\n')}

      function matchPattern(pattern, docPath) {
        const pSegments = pattern.replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
        const dSegments = docPath.replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
        const params = {};

        for (let i = 0; i < pSegments.length; i++) {
          const p = pSegments[i];
          if (p.endsWith('=**}') && p.startsWith('{')) {
            const paramName = p.slice(1, -4);
            params[paramName] = dSegments.slice(i).join('/');
            return { matches: true, params };
          }
          if (p.startsWith('{') && p.endsWith('}')) {
            if (i >= dSegments.length) return { matches: false };
            const paramName = p.slice(1, -1);
            params[paramName] = dSegments[i];
          } else {
            if (i >= dSegments.length || dSegments[i] !== p) return { matches: false };
          }
        }
        if (pSegments.length !== dSegments.length) {
          return { matches: false };
        }
        return { matches: true, params };
      }

      ${matchBlocks
        .map((mb, idx) => {
          const blockRulesCode = mb.allowRules
            .map((rule) => {
              const opsCondition = rule.ops
                .map((op) => {
                  if (op === 'read') {
                    return `(operation === 'read' || operation === 'get' || operation === 'list')`;
                  }
                  if (op === 'write') {
                    return `(operation === 'write' || operation === 'create' || operation === 'update' || operation === 'delete')`;
                  }
                  return `operation === '${op}'`;
                })
                .join(' || ');

              return `
              if (${opsCondition}) {
                try {
                  if (${rule.condition}) return true;
                } catch (e) {
                  // Firestore evaluation errors result in false (denial)
                }
              }
            `;
            })
            .join('\n');

          return `
          function evaluateBlock_${idx}(matchParams) {
            const userId = matchParams.userId;
            const document = matchParams.document;
            ${blockRulesCode}
            return false;
          }

          {
            const matchResult = matchPattern('${mb.path}', path);
            if (matchResult.matches) {
              const mbAllowed = evaluateBlock_${idx}(matchResult.params);
              if (mbAllowed) return true;
            }
          }
        `;
        })
        .join('\n')}

      return false;
    };
  `;

  const evaluatorFactory = new Function(code);
  return {
    evaluator: evaluatorFactory(),
    functions: functions.map((f) => f.name),
    matchPaths: matchBlocks.map((m) => m.path),
  };
}

describe('firestore.rules — Automated Security Rules Logic Verification (SEC-04)', () => {
  assert.ok(fs.existsSync(RULES_PATH), `firestore.rules must exist at ${RULES_PATH}`);
  const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');
  const compiled = compileFirestoreRules(rulesContent);
  const evaluate = compiled.evaluator;

  // Helper factory for valid v2 user documents
  function createValidUserDoc(overrides = {}) {
    return {
      schemaVersion: 2,
      email: 'alice@hospital.org.il',
      displayName: 'Alice Preceptor',
      mistakes: ['q_001', 'q_045'],
      mistakeTimestamps: {
        q_001: { updatedAt: 1715000000000, removed: false },
        q_045: { updatedAt: 1715000100000, removed: false },
      },
      userStats: {
        totalAnswered: 42,
        totalCorrect: 36,
        examsCompleted: 3,
        categoryStats: {
          'ניהול טיפול': 12,
          'פרמקולוגיה וחישובים': 10,
        },
        lastResetAt: 1710000000000,
      },
      savedExams: [
        { id: 'saved_slot_1', title: 'מבחן ממשלתי לדוגמה 2024', questionIds: ['q_001'] },
      ],
      updatedAt: '2026-11-12T01:00:00.000Z',
      ...overrides,
    };
  }

  it('reads and compiles production firestore.rules from repository root', () => {
    assert.ok(rulesContent.includes("rules_version = '2';"));
    assert.ok(compiled.functions.includes('isAuthenticated'));
    assert.ok(compiled.functions.includes('isOwner'));
    assert.ok(compiled.functions.includes('isValidUserDocument'));
    assert.ok(compiled.matchPaths.includes('/users/{userId}'));
    assert.ok(compiled.matchPaths.includes('/{document=**}'));
  });

  describe('Invariant A: Unauthenticated requests (auth == null) are rejected [SEC-04.a]', () => {
    it('rejects unauthenticated get/read on /users/alice', () => {
      const allowed = evaluate({
        request: { auth: null },
        resource: { data: createValidUserDoc() },
        path: '/users/alice',
        operation: 'read',
      });
      assert.equal(allowed, false, 'Unauthenticated read must be rejected');
    });

    it('rejects unauthenticated create on /users/alice', () => {
      const allowed = evaluate({
        request: { auth: null, resource: { data: createValidUserDoc() } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Unauthenticated create must be rejected');
    });

    it('rejects unauthenticated update on /users/alice', () => {
      const allowed = evaluate({
        request: { auth: null, resource: { data: createValidUserDoc() } },
        resource: { data: createValidUserDoc() },
        path: '/users/alice',
        operation: 'update',
      });
      assert.equal(allowed, false, 'Unauthenticated update must be rejected');
    });

    it('rejects unauthenticated delete on /users/alice', () => {
      const allowed = evaluate({
        request: { auth: null },
        resource: { data: createValidUserDoc() },
        path: '/users/alice',
        operation: 'delete',
      });
      assert.equal(allowed, false, 'Unauthenticated delete must be rejected');
    });

    it('rejects unauthenticated write with anonymous or missing auth token', () => {
      const allowed = evaluate({
        request: { auth: undefined, resource: { data: createValidUserDoc() } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Missing auth object must be rejected');
    });
  });

  describe('Invariant B: Authenticated owner Alice reading/writing /users/alice is permitted [SEC-04.b]', () => {
    it('permits Alice (auth.uid == "alice") reading /users/alice', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'alice' } },
        resource: { data: createValidUserDoc() },
        path: '/users/alice',
        operation: 'read',
      });
      assert.equal(allowed, true, 'Alice must be allowed to read her own document');
    });

    it('permits Alice creating /users/alice with a schema-compliant user document', () => {
      const doc = createValidUserDoc();
      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: doc } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, true, 'Alice must be allowed to create her own valid document');
    });

    it('permits Alice updating /users/alice with new valid progress state', () => {
      const existingDoc = createValidUserDoc();
      const updatedDoc = createValidUserDoc({
        mistakes: ['q_001', 'q_045', 'q_099'],
        userStats: {
          totalAnswered: 43,
          totalCorrect: 36,
          examsCompleted: 3,
          categoryStats: { 'ניהול טיפול': 13 },
        },
        updatedAt: Date.now(),
      });

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: updatedDoc } },
        resource: { data: existingDoc },
        path: '/users/alice',
        operation: 'update',
      });
      assert.equal(allowed, true, 'Alice must be allowed to update her own document');
    });

    it('permits creating a document with optional fields omitted', () => {
      const minimalDoc = {
        mistakes: [],
        userStats: {
          totalAnswered: 0,
          totalCorrect: 0,
          examsCompleted: 0,
          categoryStats: {},
        },
        savedExams: [],
        updatedAt: '2026-11-12T01:00:00Z',
      };

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: minimalDoc } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(
        allowed,
        true,
        'Minimal document with optional fields omitted must be permitted'
      );
    });
  });

  describe('Invariant C: Authenticated user Alice reading/writing /users/bob is rejected [SEC-04.c]', () => {
    it('rejects Alice reading /users/bob (cross-user data exfiltration)', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'alice' } },
        resource: { data: createValidUserDoc() },
        path: '/users/bob',
        operation: 'read',
      });
      assert.equal(allowed, false, 'Cross-user read must be denied');
    });

    it('rejects Alice creating /users/bob (cross-user document injection)', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: createValidUserDoc() } },
        resource: { data: {} },
        path: '/users/bob',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Cross-user create must be denied');
    });

    it('rejects Alice updating /users/bob (cross-user document tampering)', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: createValidUserDoc() } },
        resource: { data: createValidUserDoc() },
        path: '/users/bob',
        operation: 'update',
      });
      assert.equal(allowed, false, 'Cross-user update must be denied');
    });

    it('rejects Alice deleting /users/bob', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'alice' } },
        resource: { data: createValidUserDoc() },
        path: '/users/bob',
        operation: 'delete',
      });
      assert.equal(allowed, false, 'Cross-user delete must be denied');
    });
  });

  describe('Invariant D: User deletion is strictly forbidden (allow delete: if false;) [SEC-04.d]', () => {
    it('rejects Alice attempting to delete /users/alice', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'alice' } },
        resource: { data: createValidUserDoc() },
        path: '/users/alice',
        operation: 'delete',
      });
      assert.equal(allowed, false, 'Owner delete must be denied (allow delete: if false)');
    });

    it('rejects Bob attempting to delete /users/bob', () => {
      const allowed = evaluate({
        request: { auth: { uid: 'bob' } },
        resource: { data: createValidUserDoc() },
        path: '/users/bob',
        operation: 'delete',
      });
      assert.equal(allowed, false, 'User document deletion is completely disabled');
    });
  });

  describe('Invariant E: Default-deny catch-all rejects all unlisted collections [SEC-04.e]', () => {
    it('rejects read and write to /admins/admin_1', () => {
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' } },
          resource: { data: {} },
          path: '/admins/admin_1',
          operation: 'read',
        }),
        false
      );
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: { role: 'superadmin' } } },
          resource: { data: {} },
          path: '/admins/admin_1',
          operation: 'create',
        }),
        false
      );
    });

    it('rejects read and write to /audit_logs/12345', () => {
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' } },
          path: '/audit_logs/12345',
          operation: 'read',
        }),
        false
      );
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: { event: 'login' } } },
          path: '/audit_logs/12345',
          operation: 'create',
        }),
        false
      );
    });

    it('rejects read and write to nested subcollections (/users/alice/sessions/active)', () => {
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' } },
          path: '/users/alice/sessions/active',
          operation: 'read',
        }),
        false
      );
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: { token: 'xyz' } } },
          path: '/users/alice/sessions/active',
          operation: 'create',
        }),
        false
      );
    });
  });

  describe('Invariant F: Strict schema validation rejects malformed payloads [SEC-04.f]', () => {
    it('rejects creation when required fields are missing', () => {
      const docMissingMistakes = createValidUserDoc();
      delete docMissingMistakes.mistakes;

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: docMissingMistakes } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Document missing required "mistakes" must be rejected');
    });

    it('rejects creation with undeclared fields (disallowed field injection)', () => {
      const docWithExtra = createValidUserDoc({
        role: 'admin',
        isSuperuser: true,
      });

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: docWithExtra } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Document with unwhitelisted field must be rejected');
    });

    it('rejects creation with invalid schemaVersion (must be integer 2)', () => {
      const docV1 = createValidUserDoc({ schemaVersion: 1 });
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: docV1 } },
          resource: { data: {} },
          path: '/users/alice',
          operation: 'create',
        }),
        false,
        'schemaVersion 1 must be rejected'
      );

      const docV3 = createValidUserDoc({ schemaVersion: 3 });
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: docV3 } },
          resource: { data: {} },
          path: '/users/alice',
          operation: 'create',
        }),
        false,
        'schemaVersion 3 must be rejected'
      );
    });

    it('rejects creation when savedExams exceeds maximum length (max 3)', () => {
      const docOversizedExams = createValidUserDoc({
        savedExams: [
          { id: '1', questionIds: [] },
          { id: '2', questionIds: [] },
          { id: '3', questionIds: [] },
          { id: '4', questionIds: [] },
        ],
      });

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: docOversizedExams } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'savedExams > 3 items must be rejected');
    });

    it('rejects creation when userStats counter is negative', () => {
      const docNegativeStats = createValidUserDoc({
        userStats: {
          totalAnswered: -1,
          totalCorrect: 0,
          examsCompleted: 0,
          categoryStats: {},
        },
      });

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: docNegativeStats } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Negative totalAnswered must be rejected');
    });

    it('rejects creation when userStats counter exceeds 10,000,000 limit', () => {
      const docOverflowStats = createValidUserDoc({
        userStats: {
          totalAnswered: 10000001,
          totalCorrect: 0,
          examsCompleted: 0,
          categoryStats: {},
        },
      });

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: docOverflowStats } },
        resource: { data: {} },
        path: '/users/alice',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Overflow totalAnswered must be rejected');
    });

    it('rejects creation when email exceeds 320 characters or is not a string', () => {
      const docLongEmail = createValidUserDoc({
        email: 'a'.repeat(321) + '@example.com',
      });
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: docLongEmail } },
          resource: { data: {} },
          path: '/users/alice',
          operation: 'create',
        }),
        false,
        'Email > 320 chars must be rejected'
      );

      const docNumericEmail = createValidUserDoc({
        email: 12345,
      });
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: docNumericEmail } },
          resource: { data: {} },
          path: '/users/alice',
          operation: 'create',
        }),
        false,
        'Non-string email must be rejected'
      );
    });

    it('rejects creation when displayName exceeds 200 characters or is not a string', () => {
      const docLongName = createValidUserDoc({
        displayName: 'n'.repeat(201),
      });
      assert.equal(
        evaluate({
          request: { auth: { uid: 'alice' }, resource: { data: docLongName } },
          resource: { data: {} },
          path: '/users/alice',
          operation: 'create',
        }),
        false,
        'displayName > 200 chars must be rejected'
      );
    });

    it('rejects update when document UID is maliciously modified', () => {
      const existingDoc = createValidUserDoc({ uid: 'alice' });
      const tamperedDoc = createValidUserDoc({ uid: 'bob' });

      const allowed = evaluate({
        request: { auth: { uid: 'alice' }, resource: { data: tamperedDoc } },
        resource: { data: existingDoc },
        path: '/users/alice',
        operation: 'update',
      });
      assert.equal(allowed, false, 'Altering uid in resource must be rejected by uidNotModified');
    });
  });
});
