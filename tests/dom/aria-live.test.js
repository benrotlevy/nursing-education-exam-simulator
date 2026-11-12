import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { mountApplication } from '../../app/js/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function loadAppEnv() {
  const htmlPath = path.join(repoRoot, 'app', 'index.html');
  const rawHtml = fs.readFileSync(htmlPath, 'utf8');
  const htmlWithoutScripts = rawHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const window = new Window({
    url: 'http://127.0.0.1:4173/',
    width: 1440,
    height: 900,
  });

  const document = window.document;
  document.write(htmlWithoutScripts);

  const questionsJson = path.join(repoRoot, 'app', 'data', 'questions.json');
  const questions = JSON.parse(fs.readFileSync(questionsJson, 'utf8'));

  mountApplication({
    window,
    document,
    localStorage: window.localStorage,
    sessionStorage: window.sessionStorage,
    navigator: window.navigator,
    preloadedQuestions: questions,
  });

  return { window, document };
}

describe('A11Y-03: ARIA Live Region & Screen Reader Politeness (DOM)', () => {
  it('verifies #appToastContainer has role="status" and aria-live="polite" [A11Y-03]', () => {
    const { document } = loadAppEnv();

    const toastContainer = document.getElementById('appToastContainer');
    assert.ok(toastContainer, 'Toast notification container #appToastContainer must exist in DOM');
    assert.equal(
      toastContainer.getAttribute('role'),
      'status',
      '#appToastContainer must declare role="status"'
    );
    assert.equal(
      toastContainer.getAttribute('aria-live'),
      'polite',
      '#appToastContainer must declare aria-live="polite"'
    );
  });

  it('verifies Study feedback renders accessible status text for screen readers upon answering [A11Y-03]', () => {
    const { window, document } = loadAppEnv();

    window.switchTab('study');

    // Answer the current study question (option 0)
    window.app.studyController.answerStudyQuestion(0);

    // The study feedback box must communicate the grading outcome to screen readers
    const feedbackBox = document.getElementById('studyExplanationBox');
    assert.ok(feedbackBox, '#studyExplanationBox must exist');
    assert.ok(
      feedbackBox.classList.contains('visible'),
      '#studyExplanationBox must be visible after answering'
    );

    // Verify screen reader politeness attributes on feedback container or its header
    const explHeader = document.getElementById('studyExplanationHeader');
    assert.ok(explHeader, '#studyExplanationHeader must exist');

    const hasLiveRegion =
      feedbackBox.getAttribute('aria-live') === 'polite' ||
      feedbackBox.getAttribute('role') === 'status' ||
      feedbackBox.getAttribute('role') === 'alert' ||
      explHeader.getAttribute('aria-live') === 'polite' ||
      explHeader.getAttribute('role') === 'status' ||
      explHeader.getAttribute('role') === 'alert';

    assert.ok(
      hasLiveRegion,
      'Study feedback container (#studyExplanationBox / #studyExplanationHeader) must declare aria-live="polite", role="status", or role="alert" for assistive technology'
    );

    const feedbackText = explHeader.textContent.trim();
    assert.ok(
      feedbackText.includes('נכון') || feedbackText.includes('מדויק'),
      'Study feedback must render accessible status text in Hebrew'
    );
  });
});
