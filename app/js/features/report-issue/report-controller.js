/**
 * Question Issue Report Controller (`app/js/features/report-issue/report-controller.js`)
 * Coordinates student report submission, auth gating, and admin moderation dashboard.
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
  toast,
  dialog,
  authController,
  reportDialogView = createReportDialogView({ document }),
  adminReportsView = createAdminReportsView({ document }),
} = {}) {
  let currentReports = [];

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

  async function openAdminDashboard() {
    const user = cloudSync?.getAuthUser?.() || null;
    if (!isAdminUser(user)) {
      toast?.showToast('לוח הבקרה זמין למנהל המערכת בלבד.');
      return false;
    }

    adminReportsView.open({
      reports: currentReports,
      allQuestions: store.getState().allQuestions || [],
      loading: true,
      callbacks: {
        onRefresh: loadAdminReports,
        onCopy: handleCopyReport,
        onUpdateStatus: handleUpdateStatus,
        onDelete: handleDeleteReport,
      },
    });

    await loadAdminReports();
    return true;
  }

  function onAuthChanged(user) {
    if (reportDialogView.isOpen()) {
      reportDialogView.updateUser(user);
    }

    if (!isAdminUser(user)) {
      reportService?.unsubscribeOpenReports?.();
      updateAdminHeaderBadge({ document, user, openCount: 0 });
      if (adminReportsView.isOpen()) {
        adminReportsView.close();
      }
      return;
    }

    updateAdminHeaderBadge({ document, user, openCount: 0 });
    reportService?.subscribeOpenReportsCount?.((openCount) => {
      updateAdminHeaderBadge({ document, user, openCount });
    });
  }

  return {
    openReportDialog,
    openAdminDashboard,
    onAuthChanged,
    loadAdminReports,
  };
}
