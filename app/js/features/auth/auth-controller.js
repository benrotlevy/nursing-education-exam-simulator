/**
 * Auth & Cloud Sync Controller (`app/js/features/auth/auth-controller.js`)
 * Coordinates Firebase Authentication UI, status badges, and Cloud Sync lifecycle.
 */

import { createCloudSyncService } from '../../services/cloud-sync.js';
import {
  renderAuthUI,
  renderSyncStatus,
  setSignInButtonLoading,
  flashSyncIndicator,
} from './auth-view.js';

export function createAuthController({
  document = globalThis.document,
  store,
  storage,
  toast,
  notifyError = null,
  firebaseSdk = null,
  sdkLoader = undefined,
  resolveCloudAuthorization = null,
  onRemoteMerged = null,
  onAuthChanged = null,
} = {}) {
  const cloudSync = createCloudSyncService({
    firebaseSdk,
    ...(sdkLoader ? { sdkLoader } : {}),
    resolveCloudAuthorization,
    store,
    storage,
    toast,
    notifyError,
    window: document?.defaultView || globalThis.window,
    navigator: document?.defaultView?.navigator || globalThis.navigator,
    onAuthChanged: (user, authDecision) => {
      renderAuthUI({
        document,
        user,
        syncStatus: store?.getState()?.auth?.syncStatus,
      });
      if (typeof onAuthChanged === 'function') {
        onAuthChanged(user, authDecision);
      }
    },
    onSignInLoadingChange: (isLoading) => {
      setSignInButtonLoading({ document, isLoading });
    },
    onSyncFlash: () => {
      flashSyncIndicator({ document });
    },
    onSyncStatusChanged: (syncStatus) => {
      renderSyncStatus({ document, syncStatus });
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
    refreshAuthorization: () => cloudSync.refreshAuthorization(),
    hasPendingPush: () => cloudSync.hasPendingPush(),
    getAuthUser: () => cloudSync.getAuthUser(),
    renderUser: (user) => renderAuthUI({ document, user }),
  };
}
