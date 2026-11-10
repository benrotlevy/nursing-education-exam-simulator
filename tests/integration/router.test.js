import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { createRouter } from '../../app/js/core/router.js';
import { STORAGE_KEYS } from '../../app/js/config.js';

function createRouterTestDOM() {
  const window = new Window();
  const document = window.document;
  document.body.innerHTML = `
    <div id="mobileSectionIndicator">
      <span id="mobileSectionTag" class="mobile-section-tag tag-exam">
        <span id="mobileSectionText"></span>
      </span>
    </div>
    <nav class="nav-tabs">
      <button id="tabExam" class="tab-btn active"></button>
      <button id="tabStudy" class="tab-btn"></button>
      <button id="tabSavedExams" class="tab-btn"></button>
      <button id="tabStats" class="tab-btn"></button>
    </nav>
    <main>
      <section id="screenExamSetup" class="screen active"></section>
      <section id="screenActiveExam" class="screen"></section>
      <section id="screenExamResults" class="screen"></section>
      <section id="screenSavedExams" class="screen"></section>
      <section id="screenStudyMode" class="screen"></section>
      <section id="screenStats" class="screen"></section>
    </main>
    <nav class="mobile-bottom-nav">
      <button id="bNavExam" class="bnav-btn active"></button>
      <button id="bNavStudy" class="bnav-btn"></button>
      <button id="bNavSaved" class="bnav-btn"></button>
      <button id="bNavStats" class="bnav-btn"></button>
    </nav>
  `;
  return { window, document };
}

describe('app/js/core/router.js — Navigation & Screen Synchronization (NAV-01..NAV-04)', () => {
  it('switches across all 4 tabs, synchronizes desktop + mobile nav, and updates mobile indicator pill [NAV-01, NAV-02, NAV-03, NAV-04]', () => {
    const { window, document } = createRouterTestDOM();
    const state = {
      activeTab: 'exam',
      activeExamScreen: 'SETUP',
      currentExam: { questions: [] },
      currentStudy: { mistakesOnly: false },
      savedExams: [{ id: 's1' }],
      mistakes: new Set(['q_001']),
    };

    const router = createRouter({
      document,
      sessionStorage: window.sessionStorage,
      getState: () => state,
      onTabActivated: (tabId) => {
        state.activeTab = tabId;
      },
    });

    router.switchTab('study');
    assert.equal(document.getElementById('tabStudy').classList.contains('active'), true);
    assert.equal(document.getElementById('bNavStudy').classList.contains('active'), true);
    assert.equal(document.getElementById('screenStudyMode').classList.contains('active'), true);
    assert.equal(document.getElementById('screenExamSetup').classList.contains('active'), false);
    assert.equal(document.getElementById('mobileSectionTag').classList.contains('tag-study'), true);
    assert.equal(window.sessionStorage.getItem(STORAGE_KEYS.ACTIVE_TAB), 'study');

    router.switchTab('saved-exams');
    assert.equal(document.getElementById('tabSavedExams').classList.contains('active'), true);
    assert.equal(document.getElementById('bNavSaved').classList.contains('active'), true);
    assert.equal(document.getElementById('screenSavedExams').classList.contains('active'), true);
    assert.match(document.getElementById('mobileSectionText').textContent, /1\/3/);

    router.switchTab('stats');
    assert.equal(document.getElementById('tabStats').classList.contains('active'), true);
    assert.equal(document.getElementById('bNavStats').classList.contains('active'), true);
    assert.equal(document.getElementById('screenStats').classList.contains('active'), true);

    // Exam sub-screen routing: ACTIVE vs RESULTS vs SETUP
    state.activeExamScreen = 'ACTIVE';
    state.currentExam = { questions: [{ id: 'q_001' }, { id: 'q_002' }], currentIndex: 0 };
    router.switchTab('exam');
    assert.equal(document.getElementById('screenActiveExam').classList.contains('active'), true);
    assert.match(document.getElementById('mobileSectionText').textContent, /\(1\/2\)/);

    state.activeExamScreen = 'RESULTS';
    router.switchTab('exam');
    assert.equal(document.getElementById('screenExamResults').classList.contains('active'), true);
  });
});
