/**
 * Service Worker (`app/sw.js`)
 * Provides full offline-capable PWA caching with a Network-First strategy for same-origin
 * assets and strict pass-through for external Firebase Auth, Firestore, Fonts, and Telegram traffic.
 */

const CACHE_PREFIX = 'nursing-exam-sim-';
const CACHE_NAME = `${CACHE_PREFIX}v2.4.1`;

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './data/questions-demo.json',
  './data/questions.enc.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './styles/base.css',
  './styles/layout.css',
  './styles/main.css',
  './styles/tokens.css',
  './styles/utilities.css',
  './styles/components/badges.css',
  './styles/components/buttons.css',
  './styles/components/cards.css',
  './styles/components/dialog.css',
  './styles/components/explanation.css',
  './styles/components/forms.css',
  './styles/components/toast.css',
  './styles/features/exam.css',
  './styles/features/report-issue.css',
  './styles/features/saved-exams.css',
  './styles/features/stats.css',
  './styles/features/study.css',
  './js/config.js',
  './js/main.js',
  './js/core/events.js',
  './js/core/router.js',
  './js/core/storage.js',
  './js/core/store.js',
  './js/domain/access-control.js',
  './js/domain/ai-prompt.js',
  './js/domain/exam-session.js',
  './js/domain/explanation-parser.js',
  './js/domain/question-pool.js',
  './js/domain/question-report.js',
  './js/domain/saved-exams.js',
  './js/domain/shuffle.js',
  './js/domain/stats.js',
  './js/domain/study-session.js',
  './js/domain/sync-merge.js',
  './js/features/auth/auth-controller.js',
  './js/features/auth/auth-view.js',
  './js/features/auth/demo-banner-view.js',
  './js/features/exam/exam-controller.js',
  './js/features/exam/exam-view.js',
  './js/features/report-issue/admin-reports-view.js',
  './js/features/report-issue/report-controller.js',
  './js/features/report-issue/report-dialog-view.js',
  './js/features/saved-exams/saved-exams-controller.js',
  './js/features/saved-exams/saved-exams-view.js',
  './js/features/stats/stats-controller.js',
  './js/features/stats/stats-view.js',
  './js/features/study/study-controller.js',
  './js/features/study/study-view.js',
  './js/services/access-control-service.js',
  './js/services/catalog-crypto.js',
  './js/services/clipboard.js',
  './js/services/cloud-sync.js',
  './js/services/pwa.js',
  './js/services/question-repository.js',
  './js/services/report-service.js',
  './js/ui/dialog.js',
  './js/ui/dom.js',
  './js/ui/explanation-card.js',
  './js/ui/toast.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (
      response &&
      response.status === 200 &&
      (response.type === 'basic' || response.type === 'default')
    ) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }

    if (response && response.status >= 500) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
    }

    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const shell = (await caches.match('./index.html')) || (await caches.match('./'));
      if (shell) return shell;
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirstWithCache(request));
});
