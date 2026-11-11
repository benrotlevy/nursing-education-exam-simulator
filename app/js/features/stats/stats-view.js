/**
 * Statistics & Analytics View (`app/js/features/stats/stats-view.js`)
 * Pure DOM rendering for overall metrics, category progress bars, and readiness insight banner.
 */

import { computeDashboardStats } from '../../domain/stats.js';
import { escapeHTML } from '../../ui/dom.js';

export function renderStatsView({
  document = globalThis.document,
  userStats = {},
  mistakes = new Set(),
  allQuestions = [],
  categories,
} = {}) {
  const vm = computeDashboardStats({
    userStats,
    mistakes,
    allQuestions,
    categories,
  });

  const accEl = document?.getElementById('statAccuracyVal');
  if (accEl) accEl.textContent = `${vm.accuracyPct}%`;

  const totalEl = document?.getElementById('statTotalAnswered');
  if (totalEl) totalEl.textContent = String(vm.totalAnswered);

  const mistakesEl = document?.getElementById('statMistakesActive');
  if (mistakesEl) mistakesEl.textContent = String(vm.mistakesCount);

  const examsEl = document?.getElementById('statExamsCompleted');
  if (examsEl) examsEl.textContent = String(vm.examsCompleted);

  const container = document?.getElementById('categoryStatsBars');
  if (container) {
    container.innerHTML = '';

    vm.categoryBreakdown.forEach((catItem) => {
      let barColor = 'var(--primary)';
      if (catItem.total > 0) {
        if (catItem.pct >= 80) barColor = 'var(--success)';
        else if (catItem.pct >= 65) barColor = 'var(--warning)';
        else barColor = 'var(--danger)';
      }

      const barEl = document.createElement('div');
      barEl.className = 'cat-bar-item';
      barEl.innerHTML = `
        <div class="cat-bar-header">
          <span>${escapeHTML(catItem.category)} <small class="u-text-muted">(${catItem.correct}/${catItem.total} שנענו &bull; מתוך ${catItem.totalInDb} שאלות במאגר)</small></span>
          <span style="font-weight:800; color:${barColor}">${catItem.total > 0 ? catItem.pct + '%' : 'טרם נבחן'}</span>
        </div>
        <div class="cat-bar-bg">
          <div class="cat-bar-fill" style="width:${catItem.pct}%; background:${barColor}"></div>
        </div>
      `;
      container.appendChild(barEl);
    });
  }

  const bannerTitle = document?.getElementById('statsInsightTitle');
  const bannerDesc = document?.getElementById('statsInsightDesc');
  if (bannerTitle) bannerTitle.textContent = vm.insightTitle;
  if (bannerDesc) bannerDesc.textContent = vm.insightDesc;

  return vm;
}
