/**
 * Question Issue Report & Admin Dashboard Controller (`app/js/features/report-issue/report-controller.js`)
 * Coordinates student report submission, auth gating, and the 2-tab Admin Dashboard
 * (Question Reports + Invite-Only Approved Users Management).
 */

import { REPORT_STATUSES } from '../../config.js';
import { formatReportForAdminClipboard, isAdminUser } from '../../domain/question-report.js';
import { copyTextToClipboard } from '../../services/clipboard.js';
import { createReportDialogView } from './report-dialog-view.js';
import { createAdminReportsView, updateAdminHeaderBadge } from './admin-reports-view.js';

export function createReportController({
  document = globalThis.document,
  navigator = globalThis.navigator,
  store,
  cloudSync,
  reportService,
  accessControlService = null,
  toast,
  dialog,
  authController,
  onCatalogKeyUpdated = null,
  onContactConfigUpdated = null,
  reportDialogView = createReportDialogView({ document }),
  adminReportsView = createAdminReportsView({ document }),
} = {}) {
  let currentReports = [];
  let currentUsers = [];
  let currentConfigStatus = { hasCatalogKey: false, telegramUrl: '' };
  let openReportsCount = 0;
  let pendingUsersCount = 0;

  function syncBadge(user = cloudSync?.getAuthUser?.() || null) {
    updateAdminHeaderBadge({
      document,
      user,
      openCount: openReportsCount,
      pendingUsersCount,
    });
  }

  function resolveQuestion({ source = '', questionId = '' } = {}) {
    const state = store.getState();

    if (questionId) {
      const fromCatalog = (state.allQuestions || []).find((q) => q && q.id === questionId);
      if (fromCatalog) return fromCatalog;
      const fromExam = (state.currentExam?.questions || []).find((q) => q && q.id === questionId);
      if (fromExam) return fromExam;
    }

    if (source === 'exam') {
      const idx = state.currentExam?.currentIndex || 0;
      return state.currentExam?.questions?.[idx] || null;
    }

    if (source === 'study') {
      const idx = state.currentStudy?.currentIndex || 0;
      return state.currentStudy?.questions?.[idx] || null;
    }

    return null;
  }

  async function handleSubmitReport({ question, issueType, comment }) {
    if (!reportService) return;
    reportDialogView.setSubmitting(true);

    const result = await reportService.submitReport({
      question,
      issueType,
      comment,
    });

    if (!result.ok) {
      reportDialogView.setSubmitting(false);
      reportDialogView.setError(result.message || 'שליחת הדיווח נכשלה.');
      return;
    }

    reportDialogView.close();
    toast?.showToast('תודה! הדיווח נשלח ונשמר בהצלחה ✅');
  }

  function openReportDialog({ source = 'study', questionId = '' } = {}) {
    const question = resolveQuestion({ source, questionId });
    if (!question) {
      toast?.showToast('לא נמצאה שאלה פעילה לדיווח');
      return false;
    }

    const user = cloudSync?.getAuthUser?.() || null;
    reportDialogView.open({
      question,
      user,
      onSubmit: handleSubmitReport,
      onSignInRequested: () => {
        authController?.signIn?.();
      },
    });
    return true;
  }

  async function loadAdminReports() {
    if (!reportService) return;
    adminReportsView.setLoading(true);
    const reports = await reportService.fetchReports({ maxResults: 150 });
    currentReports = reports;
    adminReportsView.setReports(reports, store.getState().allQuestions || []);
  }

  async function loadAdminUsers() {
    if (!accessControlService) return;
    adminReportsView.setUsersLoading(true);
    const [users, cfg] = await Promise.all([
      accessControlService.fetchAllowedUsers(),
      accessControlService.fetchAdminConfigStatus(),
    ]);
    currentUsers = users;
    currentConfigStatus = cfg;
    pendingUsersCount = users.filter(
      (u) => u && u.active !== true && u.status !== 'REVOKED'
    ).length;
    syncBadge();
    adminReportsView.setUsers(currentUsers, currentConfigStatus);
  }

  async function handleCopyReport(report, fullQuestion) {
    const formatted = formatReportForAdminClipboard(report, fullQuestion);
    const copied = await copyTextToClipboard(formatted, { navigator, document });
    toast?.showToast(copied ? 'פרטי הדיווח והשאלה הועתקו ללוח ✅' : 'לא ניתן לגשת ללוח בדפדפן זה');
  }

  async function handleUpdateStatus(report, nextStatus) {
    if (!reportService || !report?.id) return;
    adminReportsView.setBusyReport(report.id);

    const result = await reportService.updateReportStatus({
      reportId: report.id,
      status: nextStatus,
    });

    if (!result.ok) {
      adminReportsView.setBusyReport(null);
      toast?.showToast(result.message || 'עדכון הסטטוס נכשל.');
      return;
    }

    currentReports = currentReports.map((item) =>
      item.id === report.id ? { ...item, ...result.updateData } : item
    );
    adminReportsView.setReports(currentReports, store.getState().allQuestions || []);

    const labels = {
      [REPORT_STATUSES.RESOLVED]: 'הדיווח סומן כתוקן ✅',
      [REPORT_STATUSES.DISMISSED]: 'הדיווח נדחה',
      [REPORT_STATUSES.OPEN]: 'הדיווח נפתח מחדש',
    };
    toast?.showToast(labels[nextStatus] || 'הסטטוס עודכן');
  }

  async function handleDeleteReport(report) {
    if (!reportService || !report?.id) return;
    const confirmed = dialog?.confirmDialog
      ? await dialog.confirmDialog({
          title: 'מחיקת דיווח',
          message: `האם למחוק לצמיתות את הדיווח על שאלה ${report.questionId}?`,
          confirmText: 'מחק דיווח',
          cancelText: 'ביטול',
          danger: true,
        })
      : true;

    if (!confirmed) return;

    adminReportsView.setBusyReport(report.id);
    const result = await reportService.deleteReport(report.id);

    if (!result.ok) {
      adminReportsView.setBusyReport(null);
      toast?.showToast(result.message || 'מחיקת הדיווח נכשלה.');
      return;
    }

    currentReports = currentReports.filter((item) => item.id !== report.id);
    adminReportsView.setReports(currentReports, store.getState().allQuestions || []);
    toast?.showToast('הדיווח נמחק');
  }

  async function handleAddUser({ email, note }) {
    if (!accessControlService) return;
    const result = await accessControlService.approveUser({ email, note });
    if (!result.ok) {
      toast?.showToast(result.message || 'הוספת המשתמש נכשלה.');
      return;
    }
    const cleanEmail = result.userDoc.email;
    const idx = currentUsers.findIndex((u) => (u.email || u.id) === cleanEmail);
    if (idx >= 0) {
      currentUsers = currentUsers.map((u, i) => (i === idx ? result.userDoc : u));
    } else {
      currentUsers = [result.userDoc, ...currentUsers];
    }
    adminReportsView.setUsers(currentUsers, currentConfigStatus);
    toast?.showToast(`המשתמש ${cleanEmail} אושר בהצלחה ✅`);
  }

  async function handleApproveUser(userItem) {
    const email = userItem?.email || userItem?.id || '';
    if (!accessControlService || !email) return;
    adminReportsView.setBusyUser(email);

    const result = await accessControlService.approveUser({
      email,
      note: userItem.note || '',
      displayName: userItem.displayName || '',
      uid: userItem.uid || '',
      existingAddedAt: userItem.addedAt || '',
    });

    if (!result.ok) {
      adminReportsView.setBusyUser(null);
      toast?.showToast(result.message || 'אישור המשתמש נכשל.');
      return;
    }

    currentUsers = currentUsers.map((u) => ((u.email || u.id) === email ? result.userDoc : u));
    adminReportsView.setUsers(currentUsers, currentConfigStatus);
    toast?.showToast(`הגישה אושרה עבור ${email} ✅`);
  }

  async function handleRevokeUser(userItem) {
    const email = userItem?.email || userItem?.id || '';
    if (!accessControlService || !email) return;
    adminReportsView.setBusyUser(email);

    const result = await accessControlService.revokeUser({ email, existingDoc: userItem });
    if (!result.ok) {
      adminReportsView.setBusyUser(null);
      toast?.showToast(result.message || 'השהיית המשתמש נכשלה.');
      return;
    }

    currentUsers = currentUsers.map((u) => ((u.email || u.id) === email ? result.userDoc : u));
    adminReportsView.setUsers(currentUsers, currentConfigStatus);
    toast?.showToast(`הגישה הושהתה עבור ${email}`);
  }

  async function handleDeleteUser(userItem) {
    const email = userItem?.email || userItem?.id || '';
    if (!accessControlService || !email) return;

    const confirmed = dialog?.confirmDialog
      ? await dialog.confirmDialog({
          title: 'הסרת משתמש',
          message: `האם להסיר את ${email} מרשימת המשתמשים?`,
          confirmText: 'הסר משתמש',
          cancelText: 'ביטול',
          danger: true,
        })
      : true;

    if (!confirmed) return;

    adminReportsView.setBusyUser(email);
    const result = await accessControlService.deleteAllowedUser(email);
    if (!result.ok) {
      adminReportsView.setBusyUser(null);
      toast?.showToast(result.message || 'מחיקת המשתמש נכשלה.');
      return;
    }

    currentUsers = currentUsers.filter((u) => (u.email || u.id) !== email);
    adminReportsView.setUsers(currentUsers, currentConfigStatus);
    toast?.showToast(`המשתמש ${email} הוסר מהרשימה`);
  }

  async function handleSaveCatalogKey(keyBase64) {
    if (!accessControlService) return;
    const result = await accessControlService.saveCatalogKey(keyBase64);
    if (!result.ok) {
      toast?.showToast(result.message || 'שמירת המפתח נכשלה.');
      return;
    }
    currentConfigStatus = { ...currentConfigStatus, hasCatalogKey: true };
    adminReportsView.setConfigStatus(currentConfigStatus);
    toast?.showToast('מפתח הפענוח נשמר בענן! טוען מאגר מלא 🔑');
    if (typeof onCatalogKeyUpdated === 'function') {
      await onCatalogKeyUpdated(String(keyBase64 || '').trim());
    }
  }

  async function handleSaveTelegramUrl(telegramUrl) {
    if (!accessControlService) return;
    const result = await accessControlService.saveContactConfig({ telegramUrl });
    if (!result.ok) {
      toast?.showToast(result.message || 'שמירת קישור ה-Telegram נכשלה.');
      return;
    }
    currentConfigStatus = { ...currentConfigStatus, telegramUrl: result.telegramUrl };
    adminReportsView.setConfigStatus(currentConfigStatus);
    toast?.showToast('קישור ה-Telegram עודכן בהצלחה ✅');
    if (typeof onContactConfigUpdated === 'function') {
      onContactConfigUpdated(result.telegramUrl);
    }
  }

  async function openAdminDashboard({ initialTab = 'reports' } = {}) {
    const user = cloudSync?.getAuthUser?.() || null;
    if (!isAdminUser(user)) {
      toast?.showToast('לוח הבקרה זמין למנהל המערכת בלבד.');
      return false;
    }

    adminReportsView.open({
      reports: currentReports,
      users: currentUsers,
      allQuestions: store.getState().allQuestions || [],
      initialTab,
      loading: initialTab === 'reports',
      usersLoading: initialTab === 'users',
      adminConfigStatus: currentConfigStatus,
      callbacks: {
        onRefresh: loadAdminReports,
        onCopy: handleCopyReport,
        onUpdateStatus: handleUpdateStatus,
        onDelete: handleDeleteReport,
        onRefreshUsers: loadAdminUsers,
        onAddUser: handleAddUser,
        onApproveUser: handleApproveUser,
        onRevokeUser: handleRevokeUser,
        onDeleteUser: handleDeleteUser,
        onSaveCatalogKey: handleSaveCatalogKey,
        onSaveTelegramUrl: handleSaveTelegramUrl,
      },
    });

    if (initialTab === 'users') {
      await loadAdminUsers();
    } else {
      await loadAdminReports();
    }
    return true;
  }

  function onAuthChanged(user) {
    if (reportDialogView.isOpen()) {
      reportDialogView.updateUser(user);
    }

    if (!isAdminUser(user)) {
      reportService?.unsubscribeOpenReports?.();
      accessControlService?.unsubscribePendingRequests?.();
      openReportsCount = 0;
      pendingUsersCount = 0;
      syncBadge(user);
      if (adminReportsView.isOpen()) {
        adminReportsView.close();
      }
      return;
    }

    syncBadge(user);
    reportService?.subscribeOpenReportsCount?.((openCount) => {
      openReportsCount = openCount;
      syncBadge(user);
    });
    accessControlService?.subscribePendingRequestsCount?.((pendingCount) => {
      pendingUsersCount = pendingCount;
      syncBadge(user);
    });
  }

  return {
    openReportDialog,
    openAdminDashboard,
    onAuthChanged,
    loadAdminReports,
    loadAdminUsers,
  };
}
