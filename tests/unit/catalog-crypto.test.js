import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptCatalogPayload,
  encryptCatalogPayload,
  generateCatalogKeyBase64,
} from '../../app/js/services/catalog-crypto.js';

describe('app/js/services/catalog-crypto.js — AES-256-GCM Question Catalog Encryption', () => {
  const samplePayload = {
    version: 2,
    totalQuestions: 2,
    questions: [
      {
        id: 'q_001',
        category: 'אתיקה, חוק ובטיחות המטופל',
        source: 'מבחן 2024',
        question: 'מהי ההתערבות המועדפת?',
        options: ['א', 'ב', 'ג', 'ד'],
        correctIndex: 0,
        detailedExplanation: '• הרציונל הפדגוגי: הסבר לדוגמה.',
      },
      {
        id: 'q_002',
        category: 'משוב, הערכה ורפלקציה',
        source: 'מבחן 2023',
        question: 'שאלה שנייה בעברית עם מספרים 123',
        options: ['1', '2', '3', '4'],
        correctIndex: 2,
        detailedExplanation: '• הרציונל הפדגוגי: נימוק.',
      },
    ],
  };

  it('encrypts and decrypts Hebrew question catalogs with 256-bit Web Crypto AES-GCM', async () => {
    const keyBase64 = generateCatalogKeyBase64();
    const envelope = await encryptCatalogPayload(samplePayload, keyBase64);

    assert.equal(envelope.version, 1);
    assert.equal(envelope.alg, 'AES-256-GCM');
    assert.equal(envelope.totalQuestions, 2);
    assert.ok(typeof envelope.iv === 'string' && envelope.iv.length >= 16);
    assert.equal(envelope.ciphertext.includes('מהי ההתערבות'), false);

    const decrypted = await decryptCatalogPayload(envelope, keyBase64);
    assert.deepStrictEqual(decrypted.questions, samplePayload.questions);
  });

  it('rejects decryption with wrong key, short key, or tampered ciphertext', async () => {
    const key1 = generateCatalogKeyBase64();
    const key2 = generateCatalogKeyBase64();
    const envelope = await encryptCatalogPayload(samplePayload, key1);

    await assert.rejects(() => decryptCatalogPayload(envelope, key2));
    await assert.rejects(() => decryptCatalogPayload(envelope, 'short'));

    const tampered = {
      ...envelope,
      ciphertext: envelope.ciphertext.slice(0, -4) + 'AAAA',
    };
    await assert.rejects(() => decryptCatalogPayload(tampered, key1));
  });
});
