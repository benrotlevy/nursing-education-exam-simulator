/**
 * Auth & Cloud Sync Controller (`app/js/features/auth/auth-controller.js`)
 * Coordinates Firebase Authentication UI, status badges, and Cloud Sync lifecycle.
 */

import { createCloudSyncService } from '../../services/cloud-sync.js';
import { renderAuthUI, setSignInButtonLoading, flashSyncIndicator } from './auth-view.js';

export function createAuthController({
  document = globalThis.document,
  store,
  storage,
  toast,
  notifyError = null,
  firebaseSdk = null,
  sdkLoader = undefined,
  onRemoteMerged = null,
} = {}) {
  const cloudSync = createCloudSyncService({
    firebaseSdk,
    ...(sdkLoader ? { sdkLoader } : {}),
    store,
    storage,
    toast,
    notifyError,
    onAuthChanged: (user) => {
      renderAuthUI({ document, user });
    },
    onSignInLoadingChange: (isLoading) => {
      setSignInButtonLoading({ document, isLoading });
    },
    onSyncFlash: () => {
      flashSyncIndicator({ document });
    },
    onRemoteMerged: (merged) => {
      if (typeof onRemoteMerged === 'function') {
        onRemoteMerged(merged);
      }
    },
  });

  return {
    cloudSync,
    init: () => cloudSync.init(),
    signIn: () => cloudSync.signIn(),
    signOut: () => cloudSync.signOut(),
    schedulePush: () => cloudSync.schedulePush(),
    resetCloudData: () => cloudSync.resetCloudData(),
    getAuthUser: () => cloudSync.getAuthUser(),
    renderUser: (user) => renderAuthUI({ document, user }),
  };
}
