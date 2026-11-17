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
    // Replace exists(/databases/$(database)/documents/...) & get(/databases/$(database)/documents/...)
    res = res.replace(
      /(exists|get)\(\s*\/databases\/\$\(database\)\/documents((?:\$\([^)]+\)|[^)])+)\)/g,
      (_full, fnName, docPath) => {
        const templatePath = docPath.replace(/\$\(([^)]+)\)/g, '${$1}');
        return `__${fnName}(\`${templatePath}\`)`;
      }
    );
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
    return function evaluate({ request, resource, path, operation, db }) {
      const defaultDb = {
        '/allowed_users/alice@hospital.org.il': {
          schemaVersion: 2,
          email: 'alice@hospital.org.il',
          active: true,
          status: 'APPROVED',
        },
      };
      const activeDb = db !== undefined ? db : defaultDb;

      function __exists(docPath) {
        return Object.prototype.hasOwnProperty.call(activeDb, docPath) && activeDb[docPath] != null;
      }

      function __get(docPath) {
        const data = __exists(docPath) ? activeDb[docPath] : {};
        return { data };
      }

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
            const reportId = matchParams.reportId;
            const email = matchParams.email;
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
    assert.ok(compiled.functions.includes('isAdmin'));
    assert.ok(compiled.functions.includes('isOwner'));
    assert.ok(compiled.functions.includes('isValidUserDocument'));
    assert.ok(compiled.functions.includes('isValidQuestionReport'));
    assert.ok(compiled.functions.includes('isApprovedUser'));
    assert.ok(compiled.functions.includes('isAuthorizedUser'));
    assert.ok(compiled.functions.includes('isValidAllowedUserDocument'));
    assert.ok(compiled.matchPaths.includes('/users/{userId}'));
    assert.ok(compiled.matchPaths.includes('/question_reports/{reportId}'));
    assert.ok(compiled.matchPaths.includes('/allowed_users/{email}'));
    assert.ok(compiled.matchPaths.includes('/app_config/catalog_key'));
    assert.ok(compiled.matchPaths.includes('/app_config/contact'));
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
        },
        resource: { data: createValidUserDoc() },
        path: '/users/alice',
        operation: 'read',
      });
      assert.equal(allowed, true, 'Alice must be allowed to read her own document');
    });

    it('permits Alice creating /users/alice with a schema-compliant user document', () => {
      const doc = createValidUserDoc();
      const allowed = evaluate({
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: doc },
        },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: updatedDoc },
        },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: minimalDoc },
        },
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

    it('permits optional releasedSavedExams tombstone map up to 200 entries and rejects non-map values', () => {
      const withReleased = {
        ...createValidUserDoc(),
        releasedSavedExams: {
          saved_1000: 1700000000000,
          'שחזור מבחן 2024': 1700000000000,
        },
      };

      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: withReleased },
          },
          resource: { data: createValidUserDoc() },
          path: '/users/alice',
          operation: 'update',
        }),
        true,
        'Valid releasedSavedExams map must be permitted'
      );

      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: { ...createValidUserDoc(), releasedSavedExams: ['bad'] } },
          },
          resource: { data: createValidUserDoc() },
          path: '/users/alice',
          operation: 'update',
        }),
        false,
        'Non-map releasedSavedExams must be rejected'
      );
    });
  });

  describe('Invariant C: Authenticated user Alice reading/writing /users/bob is rejected [SEC-04.c]', () => {
    it('rejects Alice reading /users/bob (cross-user data exfiltration)', () => {
      const allowed = evaluate({
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
        },
        resource: { data: createValidUserDoc() },
        path: '/users/bob',
        operation: 'read',
      });
      assert.equal(allowed, false, 'Cross-user read must be denied');
    });

    it('rejects Alice creating /users/bob (cross-user document injection)', () => {
      const allowed = evaluate({
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: createValidUserDoc() },
        },
        resource: { data: {} },
        path: '/users/bob',
        operation: 'create',
      });
      assert.equal(allowed, false, 'Cross-user create must be denied');
    });

    it('rejects Alice updating /users/bob (cross-user document tampering)', () => {
      const allowed = evaluate({
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: createValidUserDoc() },
        },
        resource: { data: createValidUserDoc() },
        path: '/users/bob',
        operation: 'update',
      });
      assert.equal(allowed, false, 'Cross-user update must be denied');
    });

    it('rejects Alice deleting /users/bob', () => {
      const allowed = evaluate({
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
        },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
        },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          },
          resource: { data: {} },
          path: '/admins/admin_1',
          operation: 'read',
        }),
        false
      );
      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: { role: 'superadmin' } },
          },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          },
          path: '/audit_logs/12345',
          operation: 'read',
        }),
        false
      );
      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: { event: 'login' } },
          },
          path: '/audit_logs/12345',
          operation: 'create',
        }),
        false
      );
    });

    it('rejects read and write to nested subcollections (/users/alice/sessions/active)', () => {
      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          },
          path: '/users/alice/sessions/active',
          operation: 'read',
        }),
        false
      );
      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: { token: 'xyz' } },
          },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: docMissingMistakes },
        },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: docWithExtra },
        },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: docV1 },
          },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: docV3 },
          },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: docOversizedExams },
        },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: docNegativeStats },
        },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: docOverflowStats },
        },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: docLongEmail },
          },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: docNumericEmail },
          },
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
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: docLongName },
          },
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
        request: {
          auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
          resource: { data: tamperedDoc },
        },
        resource: { data: existingDoc },
        path: '/users/alice',
        operation: 'update',
      });
      assert.equal(allowed, false, 'Altering uid in resource must be rejected by uidNotModified');
    });
  });

  describe('Invariant G: Question Reports Access Control & Schema Validation [RPT-SEC]', () => {
    function createValidReportDoc(overrides = {}) {
      return {
        schemaVersion: 2,
        questionId: 'q_042',
        questionText: 'מהי ההתערבות הראשונה המומלצת למניעת טעויות?',
        source: 'שחזור מבחן ממשלתי 2023',
        category: 'אתיקה, חוק ובטיחות המטופל',
        correctIndex: 1,
        issueType: 'KEY_ERROR',
        comment: 'לפי סילבוס משרד הבריאות התשובה הנכונה היא ג ולא ב.',
        reporterUid: 'alice',
        reporterEmail: 'alice@hospital.org.il',
        reporterName: 'אליס כהן',
        status: 'OPEN',
        createdAt: '2026-11-15T10:00:00.000Z',
        updatedAt: '2026-11-15T10:00:00.000Z',
        ...overrides,
      };
    }

    const adminAuth1 = {
      uid: 'admin-ben-1',
      token: { email: 'benjaminrotlevy@gmail.com', email_verified: true },
    };
    const adminAuth2 = {
      uid: 'admin-ben-2',
      token: { email: 'benjamin@rotlevy.com', email_verified: true },
    };

    it('rejects unauthenticated users from creating or reading /question_reports', () => {
      const report = createValidReportDoc();
      assert.equal(
        evaluate({
          request: { auth: null, resource: { data: report } },
          resource: { data: {} },
          path: '/question_reports/rpt_1',
          operation: 'create',
        }),
        false,
        'Unauthenticated create on /question_reports must be rejected'
      );

      assert.equal(
        evaluate({
          request: { auth: null },
          resource: { data: report },
          path: '/question_reports/rpt_1',
          operation: 'read',
        }),
        false,
        'Unauthenticated read on /question_reports must be rejected'
      );
    });

    it('permits authenticated non-admin users to submit schema-valid OPEN reports with matching reporterUid', () => {
      const report = createValidReportDoc({ reporterUid: 'alice' });
      assert.equal(
        evaluate({
          request: {
            auth: { uid: 'alice', token: { email: 'alice@hospital.org.il', email_verified: true } },
            resource: { data: report },
          },
          resource: { data: {} },
          path: '/question_reports/rpt_1',
          operation: 'create',
        }),
        true,
        'Signed-in user must be allowed to create valid report'
      );
    });

    it('rejects report creation with spoofed status, uid mismatch, oversized comment, or invalid issueType', () => {
      const aliceAuth = {
        uid: 'alice',
        token: { email: 'alice@hospital.org.il', email_verified: true },
      };

      assert.equal(
        evaluate({
          request: {
            auth: aliceAuth,
            resource: { data: createValidReportDoc({ status: 'RESOLVED' }) },
          },
          resource: { data: {} },
          path: '/question_reports/rpt_1',
          operation: 'create',
        }),
        false,
        'Clients must not create pre-resolved reports'
      );

      assert.equal(
        evaluate({
          request: {
            auth: aliceAuth,
            resource: { data: createValidReportDoc({ reporterUid: 'bob' }) },
          },
          resource: { data: {} },
          path: '/question_reports/rpt_1',
          operation: 'create',
        }),
        false,
        'Impersonated reporterUid must be rejected'
      );

      assert.equal(
        evaluate({
          request: {
            auth: aliceAuth,
            resource: { data: createValidReportDoc({ comment: 'א'.repeat(1001) }) },
          },
          resource: { data: {} },
          path: '/question_reports/rpt_1',
          operation: 'create',
        }),
        false,
        'Comment exceeding 1000 chars must be rejected'
      );

      assert.equal(
        evaluate({
          request: {
            auth: aliceAuth,
            resource: { data: createValidReportDoc({ issueType: 'HACKED' }) },
          },
          resource: { data: {} },
          path: '/question_reports/rpt_1',
          operation: 'create',
        }),
        false,
        'Unknown issueType must be rejected'
      );
    });

    it('strictly blocks regular users and unverified admin claims from reading, updating, or deleting reports', () => {
      const existingReport = createValidReportDoc();
      const nonAdminAuth = {
        uid: 'alice',
        token: { email: 'alice@hospital.org.il', email_verified: true },
      };
      const unverifiedAdminAuth = {
        uid: 'fake-ben',
        token: { email: 'benjaminrotlevy@gmail.com', email_verified: false },
      };

      for (const op of ['get', 'list', 'update', 'delete']) {
        assert.equal(
          evaluate({
            request: { auth: nonAdminAuth, resource: { data: existingReport } },
            resource: { data: existingReport },
            path: '/question_reports/rpt_1',
            operation: op,
          }),
          false,
          `Non-admin must be denied ${op} on /question_reports`
        );

        assert.equal(
          evaluate({
            request: { auth: unverifiedAdminAuth, resource: { data: existingReport } },
            resource: { data: existingReport },
            path: '/question_reports/rpt_1',
            operation: op,
          }),
          false,
          `Unverified email claiming admin address must be denied ${op}`
        );
      }
    });

    it('permits verified Admin accounts to read, resolve/update, and delete /question_reports', () => {
      const existingReport = createValidReportDoc();
      const resolvedUpdate = {
        ...existingReport,
        status: 'RESOLVED',
        adminNote: 'תוקן במאגר v2.2.0',
        resolvedAt: '2026-11-15T12:00:00.000Z',
        updatedAt: '2026-11-15T12:00:00.000Z',
      };

      for (const admin of [adminAuth1, adminAuth2]) {
        assert.equal(
          evaluate({
            request: { auth: admin },
            resource: { data: existingReport },
            path: '/question_reports/rpt_1',
            operation: 'read',
          }),
          true,
          `Verified admin ${admin.token.email} must be able to read reports`
        );

        assert.equal(
          evaluate({
            request: { auth: admin, resource: { data: resolvedUpdate } },
            resource: { data: existingReport },
            path: '/question_reports/rpt_1',
            operation: 'update',
          }),
          true,
          `Verified admin ${admin.token.email} must be able to resolve reports`
        );

        assert.equal(
          evaluate({
            request: { auth: admin },
            resource: { data: existingReport },
            path: '/question_reports/rpt_1',
            operation: 'delete',
          }),
          true,
          `Verified admin ${admin.token.email} must be able to delete reports`
        );
      }
    });
  });

  describe('Invariant H: Invite-Only Allowlist & Encrypted Key Protection [ACCESS-SEC]', () => {
    const adminAuth = {
      uid: 'admin-ben-1',
      token: { email: 'benjaminrotlevy@gmail.com', email_verified: true },
    };
    const pendingStudentAuth = {
      uid: 'stu-pending-1',
      token: { email: 'pending@nursing.ac.il', email_verified: true },
    };
    const approvedStudentAuth = {
      uid: 'stu-approved-1',
      token: { email: 'alice@hospital.org.il', email_verified: true },
    };

    it('rejects unapproved or revoked users from /users/{userId}, /question_reports, and /app_config/catalog_key', () => {
      const customDb = {
        '/allowed_users/revoked@nursing.ac.il': {
          schemaVersion: 2,
          email: 'revoked@nursing.ac.il',
          active: false,
          status: 'REVOKED',
          addedAt: '2026-11-17T08:00:00.000Z',
          updatedAt: '2026-11-17T08:00:00.000Z',
        },
      };
      const revokedAuth = {
        uid: 'stu-revoked',
        token: { email: 'revoked@nursing.ac.il', email_verified: true },
      };

      for (const actor of [pendingStudentAuth, revokedAuth]) {
        assert.equal(
          evaluate({
            request: { auth: actor },
            path: `/users/${actor.uid}`,
            operation: 'read',
            db: customDb,
          }),
          false,
          'Unapproved/revoked user must be denied /users/{uid} read'
        );

        assert.equal(
          evaluate({
            request: {
              auth: actor,
              resource: { data: createValidUserDoc({ email: actor.token.email }) },
            },
            resource: { data: {} },
            path: `/users/${actor.uid}`,
            operation: 'create',
            db: customDb,
          }),
          false,
          'Unapproved/revoked user must be denied /users/{uid} create'
        );

        assert.equal(
          evaluate({
            request: { auth: actor },
            path: '/app_config/catalog_key',
            operation: 'get',
            db: customDb,
          }),
          false,
          'Unapproved/revoked user must be denied /app_config/catalog_key'
        );

        assert.equal(
          evaluate({
            request: {
              auth: actor,
              resource: {
                data: {
                  schemaVersion: 2,
                  questionId: 'q_001',
                  questionText: 'שאלה',
                  issueType: 'KEY_ERROR',
                  comment: 'טעות במפתח התשובה',
                  reporterUid: actor.uid,
                  status: 'OPEN',
                  createdAt: '2026-11-17T08:00:00.000Z',
                  updatedAt: '2026-11-17T08:00:00.000Z',
                },
              },
            },
            resource: { data: {} },
            path: '/question_reports/rpt_unauth',
            operation: 'create',
            db: customDb,
          }),
          false,
          'Unapproved/revoked user must be denied creating reports'
        );
      }
    });

    it('permits verified student to self-create PENDING request but blocks self-approval or cross-user reads', () => {
      const validPendingDoc = {
        schemaVersion: 2,
        email: 'pending@nursing.ac.il',
        active: false,
        status: 'PENDING',
        note: 'סטודנט שנה ד',
        displayName: 'דני',
        uid: 'stu-pending-1',
        addedBy: 'pending@nursing.ac.il',
        addedAt: '2026-11-17T08:00:00.000Z',
        updatedAt: '2026-11-17T08:00:00.000Z',
      };

      assert.equal(
        evaluate({
          request: { auth: pendingStudentAuth, resource: { data: validPendingDoc } },
          resource: { data: {} },
          path: '/allowed_users/pending@nursing.ac.il',
          operation: 'create',
          db: {},
        }),
        true,
        'Student must be able to create own PENDING request'
      );

      assert.equal(
        evaluate({
          request: {
            auth: pendingStudentAuth,
            resource: { data: { ...validPendingDoc, active: true, status: 'APPROVED' } },
          },
          resource: { data: {} },
          path: '/allowed_users/pending@nursing.ac.il',
          operation: 'create',
          db: {},
        }),
        false,
        'Non-admin client MUST NOT self-approve'
      );

      assert.equal(
        evaluate({
          request: { auth: pendingStudentAuth },
          path: '/allowed_users/other@nursing.ac.il',
          operation: 'get',
          db: {},
        }),
        false,
        'Non-admin must NOT read another user allowlist document'
      );

      assert.equal(
        evaluate({
          request: { auth: pendingStudentAuth },
          path: '/allowed_users',
          operation: 'list',
          db: {},
        }),
        false,
        'Non-admin must NOT list all allowed users'
      );
    });

    it('permits Admin full management of /allowed_users, /app_config/catalog_key, and /app_config/contact', () => {
      const approvedDoc = {
        schemaVersion: 2,
        email: 'student@nursing.ac.il',
        active: true,
        status: 'APPROVED',
        note: 'מכללת הדסה',
        displayName: 'שרה',
        uid: '',
        addedBy: 'benjaminrotlevy@gmail.com',
        addedAt: '2026-11-17T08:00:00.000Z',
        updatedAt: '2026-11-17T08:00:00.000Z',
      };

      assert.equal(
        evaluate({
          request: { auth: adminAuth, resource: { data: approvedDoc } },
          resource: { data: {} },
          path: '/allowed_users/student@nursing.ac.il',
          operation: 'create',
          db: {},
        }),
        true,
        'Admin must be able to add approved users'
      );

      assert.equal(
        evaluate({
          request: { auth: adminAuth },
          path: '/allowed_users/student@nursing.ac.il',
          operation: 'delete',
          db: {},
        }),
        true,
        'Admin must be able to remove users'
      );

      const keyPayload = {
        schemaVersion: 2,
        keyBase64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        updatedBy: 'benjaminrotlevy@gmail.com',
        updatedAt: '2026-11-17T08:00:00.000Z',
      };

      assert.equal(
        evaluate({
          request: { auth: adminAuth, resource: { data: keyPayload } },
          resource: { data: {} },
          path: '/app_config/catalog_key',
          operation: 'create',
          db: {},
        }),
        true,
        'Admin must be able to write catalog_key'
      );

      assert.equal(
        evaluate({
          request: { auth: approvedStudentAuth },
          path: '/app_config/catalog_key',
          operation: 'get',
        }),
        true,
        'Approved student must be able to get catalog_key'
      );

      assert.equal(
        evaluate({
          request: { auth: pendingStudentAuth },
          path: '/app_config/contact',
          operation: 'get',
          db: {},
        }),
        true,
        'Authenticated pending user must be able to read admin Telegram contact link'
      );

      assert.equal(
        evaluate({
          request: {
            auth: pendingStudentAuth,
            resource: {
              data: {
                schemaVersion: 2,
                telegramUrl: 'https://t.me/evil',
                updatedAt: '2026-11-17T08:00:00.000Z',
              },
            },
          },
          path: '/app_config/contact',
          operation: 'update',
          db: {},
        }),
        false,
        'Non-admin must NOT alter contact config'
      );
    });
  });
});
