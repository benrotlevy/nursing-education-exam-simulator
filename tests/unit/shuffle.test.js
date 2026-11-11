import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shuffleArray, getShuffledQuestionOptions } from '../../app/js/domain/shuffle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const questionsPath = path.resolve(__dirname, '../../app/data/questions.json');
const { questions } = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

describe('app/js/domain/shuffle.js — Fisher-Yates & Option Tracking (POOL-01, POOL-02)', () => {
  it('returns a new permutation without mutating the input array and supports injectable RNG [POOL-01]', () => {
    const input = Object.freeze(['א', 'ב', 'ג', 'ד']);
    const zeroRng = () => 0; // Deterministic swap with index 0 each step
    const result = shuffleArray(input, zeroRng);

    assert.notStrictEqual(result, input);
    assert.deepStrictEqual(input, ['א', 'ב', 'ג', 'ד']);
    assert.deepStrictEqual([...result].sort(), [...input].sort());
    assert.deepStrictEqual(shuffleArray(null), []);
  });

  it('tracks correctIndex with 100% accuracy across 1,000 shuffles of real questions [POOL-02]', () => {
    for (let i = 0; i < 1000; i++) {
      const q = questions[i % questions.length];
      const expectedCorrectText = q.options[q.correctIndex];
      const shuffled = getShuffledQuestionOptions(q);

      assert.equal(shuffled.options.length, q.options.length);
      assert.equal(shuffled.options[shuffled.correctIndex], expectedCorrectText);
    }
  });
});
