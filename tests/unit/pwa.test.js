import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createPwaService, PWA_INSTALL_DISMISSED_KEY } from '../../app/js/services/pwa.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const APP_DIR = path.join(ROOT_DIR, 'app');

function walkFiles(dirPath, predicate) {
  const results = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, predicate));
    } else if (!predicate || predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function loadServiceWorkerRuntime({ fetchImpl, origin = 'https://benrotlevy.github.io' } = {}) {
  const swSource = fs.readFileSync(path.join(APP_DIR, 'sw.js'), 'utf8');
  const listeners = new Map();
  const stores = new Map();
  let skipWaitingCalled = false;
  let clientsClaimCalled = false;

  const ensureStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };

  const makeCacheObj = (name) => ({
    addAll: async (assets) => {
      const store = ensureStore(name);
      for (const asset of assets) {
        store.set(new URL(asset, `${origin}/nursing-education-exam-simulator/`).href, {
          status: 200,
          type: 'basic',
          body: `cached:${asset}`,
          clone() {
            return { ...this };
          },
        });
      }
    },
    put: async (req, res) => {
      const key = typeof req === 'string' ? req : req.url;
      ensureStore(name).set(key, res);
    },
    match: async (req) => {
      const urlStr = typeof req === 'string' ? req : req.url;
      const store = ensureStore(name);
      if (store.has(urlStr)) return store.get(urlStr);
      const targetUrl = new URL(urlStr, `${origin}/nursing-education-exam-simulator/`);
      for (const [k, v] of store.entries()) {
        if (new URL(k).pathname === targetUrl.pathname) return v;
      }
      return undefined;
    },
  });

  const cachesApi = {
    open: async (name) => makeCacheObj(name),
    keys: async () => Array.from(stores.keys()),
    delete: async (name) => stores.delete(name),
    match: async (req) => {
      for (const name of stores.keys()) {
        const hit = await makeCacheObj(name).match(req);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const context = {
    URL,
    Response: class MockResponse {
      constructor(body, init = {}) {
        this.body = body;
        this.status = init.status ?? 200;
        this.statusText = init.statusText ?? 'OK';
        this.type = 'default';
      }
      clone() {
        return new MockResponse(this.body, { status: this.status, statusText: this.statusText });
      }
    },
    caches: cachesApi,
    fetch: fetchImpl,
    self: {
      location: { origin, href: `${origin}/nursing-education-exam-simulator/sw.js` },
      addEventListener: (type, cb) => listeners.set(type, cb),
      skipWaiting: async () => {
        skipWaitingCalled = true;
      },
      clients: {
        claim: async () => {
          clientsClaimCalled = true;
        },
      },
    },
  };

  vm.runInNewContext(
    `${swSource}\nthis.__CORE_ASSETS__ = CORE_ASSETS;\nthis.__CACHE_NAME__ = CACHE_NAME;`,
    context
  );

  return {
    listeners,
    stores,
    coreAssets: context.__CORE_ASSETS__,
    cacheName: context.__CACHE_NAME__,
    getSkipWaitingCalled: () => skipWaitingCalled,
    getClientsClaimCalled: () => clientsClaimCalled,
  };
}

describe('PWA Manifest, Icons, Service Worker & Install UX', () => {
  it('validates app/manifest.webmanifest structure, RTL/Hebrew metadata, and all icon binaries', () => {
    const manifestPath = path.join(APP_DIR, 'manifest.webmanifest');
    assert.ok(fs.existsSync(manifestPath), 'Expected app/manifest.webmanifest to exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.dir, 'rtl');
    assert.equal(manifest.lang, 'he');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const icon of manifest.icons) {
      const iconPath = path.join(APP_DIR, icon.src.replace(/^\.\//, ''));
      assert.ok(fs.existsSync(iconPath), `Expected icon file to exist: ${iconPath}`);
      const content = fs.readFileSync(iconPath);
      if (icon.type === 'image/png') {
        assert.ok(
          content.subarray(0, 8).equals(pngSignature),
          `Expected valid PNG header in ${icon.src}`
        );
      } else if (icon.type === 'image/svg+xml') {
        assert.match(content.toString('utf8'), /<svg[\s>]/);
      }
    }

    const appleIconPath = path.join(APP_DIR, 'icons', 'apple-touch-icon.png');
    assert.ok(fs.existsSync(appleIconPath), 'Expected app/icons/apple-touch-icon.png to exist');
    assert.ok(fs.readFileSync(appleIconPath).subarray(0, 8).equals(pngSignature));
  });

  it('includes every JS, CSS, icon, data, and shell file in app/sw.js CORE_ASSETS', () => {
    const { coreAssets } = loadServiceWorkerRuntime({ fetchImpl: async () => ({ status: 200 }) });

    for (const asset of coreAssets) {
      const rel = asset === './' ? 'index.html' : asset.replace(/^\.\//, '');
      const fullPath = path.join(APP_DIR, rel);
      assert.ok(fs.existsSync(fullPath), `CORE_ASSETS entry missing on disk: ${asset}`);
    }

    const diskAssets = [
      ...walkFiles(path.join(APP_DIR, 'js'), (f) => f.endsWith('.js')),
      ...walkFiles(path.join(APP_DIR, 'styles'), (f) => f.endsWith('.css')),
      ...walkFiles(path.join(APP_DIR, 'icons')),
    ].map((absPath) => `./${path.relative(APP_DIR, absPath).replace(/\\/g, '/')}`);

    const coreSet = new Set(coreAssets);
    for (const rel of diskAssets) {
      assert.ok(coreSet.has(rel), `Asset missing from sw.js CORE_ASSETS: ${rel}`);
    }
  });

  it('caches core assets on install, evicts stale caches on activate, and falls back offline for same-origin GETs while bypassing cross-origin APIs', async () => {
    const baseUrl = 'https://benrotlevy.github.io/nursing-education-exam-simulator';
    let networkOnline = true;
    const rt = loadServiceWorkerRuntime({
      fetchImpl: async (req) => {
        if (!networkOnline) {
          throw new Error('Network offline');
        }
        return {
          status: 200,
          type: 'basic',
          url: req.url,
          body: `fresh:${req.url}`,
          clone() {
            return { ...this };
          },
        };
      },
    });

    rt.stores.set('nursing-exam-sim-v2.0.0', new Map([['old', { status: 200 }]]));

    // 1. Install
    let installWait;
    rt.listeners.get('install')({
      waitUntil: (p) => {
        installWait = p;
      },
    });
    await installWait;
    assert.equal(rt.getSkipWaitingCalled(), true);
    assert.ok(rt.stores.get(rt.cacheName).size >= rt.coreAssets.length);

    // 2. Activate (evicts older versioned cache)
    let activateWait;
    rt.listeners.get('activate')({
      waitUntil: (p) => {
        activateWait = p;
      },
    });
    await activateWait;
    assert.equal(rt.getClientsClaimCalled(), true);
    assert.equal(rt.stores.has('nursing-exam-sim-v2.0.0'), false);
    assert.equal(rt.stores.has(rt.cacheName), true);

    // 3. Bypass cross-origin and non-GET requests
    const fetchHandler = rt.listeners.get('fetch');
    let crossOriginResponded = false;
    fetchHandler({
      request: {
        method: 'GET',
        url: 'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen',
      },
      respondWith: () => {
        crossOriginResponded = true;
      },
    });
    assert.equal(crossOriginResponded, false);

    let postResponded = false;
    fetchHandler({
      request: { method: 'POST', url: `${baseUrl}/data/questions.json` },
      respondWith: () => {
        postResponded = true;
      },
    });
    assert.equal(postResponded, false);

    // 4. Online same-origin GET uses fresh network response
    let onlinePromise;
    fetchHandler({
      request: { method: 'GET', url: `${baseUrl}/data/questions.json`, mode: 'cors' },
      respondWith: (p) => {
        onlinePromise = p;
      },
    });
    const onlineRes = await onlinePromise;
    assert.equal(onlineRes.body, `fresh:${baseUrl}/data/questions.json`);

    // 5. Offline same-origin GET falls back cleanly to cached response
    networkOnline = false;
    let offlinePromise;
    fetchHandler({
      request: { method: 'GET', url: `${baseUrl}/data/questions.json`, mode: 'cors' },
      respondWith: (p) => {
        offlinePromise = p;
      },
    });
    const offlineRes = await offlinePromise;
    assert.equal(offlineRes.status, 200);
    assert.equal(offlineRes.body, `fresh:${baseUrl}/data/questions.json`);
  });

  it('includes mobile-web-app-capable alongside apple-mobile-web-app-capable and dismissible install banner markup in app/index.html', () => {
    const html = fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8');
    assert.match(html, /<meta\s+name="mobile-web-app-capable"\s+content="yes"\s*>/i);
    assert.match(html, /<meta\s+name="apple-mobile-web-app-capable"\s+content="yes"\s*>/i);
    assert.match(html, /id="pwaInstallBanner"/);
    assert.match(html, /id="btnDismissInstallPwa"/);
    assert.match(html, /data-action="dismiss-install-pwa"/);
  });

  it('wires install prompt lifecycle, dismiss persistence, and SW registration in createPwaService', async () => {
    const listeners = {};
    const installBtn = { hidden: true };
    const installBanner = { hidden: true };
    const storageMap = new Map();
    const memoryStorage = {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
    };
    const toasts = [];
    let swRegisterArgs = null;
    let promptCalled = false;

    const fakeWindow = {
      addEventListener: (evt, cb) => {
        listeners[evt] = cb;
      },
      matchMedia: () => ({ matches: false }),
      localStorage: memoryStorage,
    };

    const pwa = createPwaService({
      window: fakeWindow,
      document: {
        getElementById: (id) => {
          if (id === 'btnInstallPwa') return installBtn;
          if (id === 'pwaInstallBanner') return installBanner;
          return null;
        },
      },
      navigator: {
        serviceWorker: {
          register: async (url, opts) => {
            swRegisterArgs = { url, opts };
            return { scope: opts.scope };
          },
        },
      },
      storage: memoryStorage,
      toast: { showToast: (msg) => toasts.push(msg) },
    });

    await pwa.init();
    assert.deepEqual(swRegisterArgs, { url: './sw.js', opts: { scope: './' } });
    assert.equal(installBtn.hidden, true);
    assert.equal(installBanner.hidden, true);

    let defaultPrevented = false;
    listeners.beforeinstallprompt({
      preventDefault: () => {
        defaultPrevented = true;
      },
      prompt: async () => {
        promptCalled = true;
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });

    assert.equal(defaultPrevented, true);
    assert.equal(installBtn.hidden, false);
    assert.equal(installBanner.hidden, false);
    assert.equal(pwa.hasInstallPrompt(), true);

    // Dismissing hides both banner & install button and persists preference
    pwa.dismissInstall();
    assert.equal(pwa.isInstallDismissed(), true);
    assert.equal(installBtn.hidden, true);
    assert.equal(installBanner.hidden, true);
    assert.equal(memoryStorage.getItem(PWA_INSTALL_DISMISSED_KEY), '1');

    // Subsequent sessions respect persisted dismissal even when beforeinstallprompt fires
    const nextListeners = {};
    const nextBtn = { hidden: true };
    const nextBanner = { hidden: true };
    const nextPwa = createPwaService({
      window: {
        addEventListener: (evt, cb) => {
          nextListeners[evt] = cb;
        },
        matchMedia: () => ({ matches: false }),
      },
      document: {
        getElementById: (id) => {
          if (id === 'btnInstallPwa') return nextBtn;
          if (id === 'pwaInstallBanner') return nextBanner;
          return null;
        },
      },
      navigator: {},
      storage: memoryStorage,
    });
    await nextPwa.init();
    nextListeners.beforeinstallprompt({ preventDefault: () => {} });
    assert.equal(nextBtn.hidden, true);
    assert.equal(nextBanner.hidden, true);

    const accepted = await pwa.promptInstall();
    assert.equal(promptCalled, true);
    assert.equal(accepted, true);
    assert.equal(installBtn.hidden, true);
    assert.equal(installBanner.hidden, true);

    listeners.appinstalled();
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /הותקנה/);
  });
});
