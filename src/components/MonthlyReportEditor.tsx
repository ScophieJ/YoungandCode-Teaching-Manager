import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  UserCheck,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  MonthlyReportStatus,
  Subject,
  type MonthlyReport,
  type MonthlyReportDraft,
} from '../types/teaching';
import {
  createMonthlyReport,
  deleteMonthlyReport,
  updateMonthlyReport,
} from '../lib/firestoreService';
import { downloadMonthlyReportPdf } from '../lib/monthlyReportPdf';
import {
  CARD_CLASS,
  getMonthlyReportStatusClass,
  getSubjectBadgeClass,
  INPUT_CLASS,
} from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';
import { MonthlyReportDocumentView } from './MonthlyReportDocumentView';

interface MonthlyReportEditorProps {
  teacherId: string;
  teacherName: string;
  studentId: string;
  savedReport: MonthlyReport | null;
  initialDraft: MonthlyReportDraft;
  regenerating: boolean;
  onRegenerate?: () => Promise<void>;
  onSavedReport?: (reportId: string) => void;
  onDeleted?: () => void;
  onBack: () => void;
  onOpenStudent?: (studentId: string) => void;
}

function toDraftFromSaved(rep: MonthlyReport): MonthlyReportDraft {
  return {
    studentName: rep.studentName,
    gradeAndAge: rep.gradeAndAge,
    monthKey: rep.monthKey,
    reportYear: rep.reportYear,
    reportMonth: rep.reportMonth,
    reportingMonthLabel: rep.reportingMonthLabel,
    subjectsCovered: rep.subjectsCovered,
    completedClassesCount: rep.completedClassesCount,
    approvedAiReportsCount: rep.approvedAiReportsCount,
    totalInstructionMinutes: rep.totalInstructionMinutes,
    homeworkAssignedCount: rep.homeworkAssignedCount,
    homeworkCompletedCount: rep.homeworkCompletedCount,
    homeworkOutstandingCount: rep.homeworkOutstandingCount,
    topicsCovered: rep.topicsCovered,
    skillsAndConceptsIntroduced: rep.skillsAndConceptsIntroduced,
    practicalActivitiesAndProjects: rep.practicalActivitiesAndProjects,
    learningObjectivesAchieved: rep.learningObjectivesAchieved,
    conceptUnderstanding: rep.conceptUnderstanding,
    applicationOfLearning: rep.applicationOfLearning,
    participationAndEngagement: rep.participationAndEngagement,
    areasOfStrength: rep.areasOfStrength,
    areasRequiringDevelopment: rep.areasRequiringDevelopment,
    subjectAssessments: rep.subjectAssessments ?? [],
    homeworkAssignedSummary: rep.homeworkAssignedSummary,
    homeworkCompletionStatus: rep.homeworkCompletionStatus,
    assessmentResultsAndFeedback: rep.assessmentResultsAndFeedback,
    specificDifficultiesObserved: rep.specificDifficultiesObserved,
    conceptsNeedingRevision: rep.conceptsNeedingRevision,
    skillsRequiringPractice: rep.skillsRequiringPractice,
    overallMonthlyAssessment: rep.overallMonthlyAssessment,
    progressMadeDuringMonth: rep.progressMadeDuringMonth,
    recommendedTeachingApproachAndTargets: rep.recommendedTeachingApproachAndTargets,
    conclusion: rep.conclusion,
  };
}

export function MonthlyReportEditor({
  teacherId,
  teacherName,
  studentId,
  savedReport,
  initialDraft,
  regenerating,
  onRegenerate,
  onSavedReport,
  onDeleted,
  onBack,
  onOpenStudent,
}: MonthlyReportEditorProps) {
  const isApproved = savedReport?.status === MonthlyReportStatus.APPROVED;

  const [form, setForm] = useState<MonthlyReportDraft>(
    savedReport ? toDraftFromSaved(savedReport) : initialDraft
  );
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(
    isApproved ? 'preview' : 'edit'
  );
  const [savingAction, setSavingAction] = useState<'draft' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);

  useEffect(() => {
    if (savedReport) {
      setForm(toDraftFromSaved(savedReport));
      if (savedReport.status === MonthlyReportStatus.APPROVED) {
        setViewMode('preview');
      }
    } else {
      setForm(initialDraft);
      setViewMode('edit');
    }
  }, [savedReport, initialDraft]);

  const persist = async (targetStatus: MonthlyReportStatus) => {
    setError(null);
    setMessage(null);

    if (!form.studentName.trim() || !form.reportingMonthLabel.trim() || !form.subjectsCovered.trim()) {
      setError('Student name, reporting month, and subjects covered are required.');
      return;
    }

    setSavingAction(targetStatus === MonthlyReportStatus.APPROVED ? 'approve' : 'draft');
    try {
      if (savedReport) {
        await updateMonthlyReport(savedReport.id, {
          ...form,
          status: targetStatus,
        });
        setMessage(
          targetStatus === MonthlyReportStatus.APPROVED
            ? 'Monthly progress report approved and finalized for export.'
            : 'Draft monthly progress report updated.'
        );
        if (targetStatus === MonthlyReportStatus.APPROVED) {
          setViewMode('preview');
        }
        onSavedReport?.(savedReport.id);
      } else {
        const newId = await createMonthlyReport(teacherId, {
          ...form,
          studentId,
          status: targetStatus,
        });
        setMessage(
          targetStatus === MonthlyReportStatus.APPROVED
            ? 'Monthly progress report approved and saved.'
            : 'Monthly progress report saved as a draft.'
        );
        if (targetStatus === MonthlyReportStatus.APPROVED) {
          setViewMode('preview');
        }
        onSavedReport?.(newId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save the monthly progress report.'
      );
    } finally {
      setSavingAction(null);
      setApproveConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!savedReport) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteMonthlyReport(savedReport.id);
      setDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete the monthly progress report.'
      );
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const updateSubjectField = (
    idx: number,
    key: 'criteriaFocus' | 'coverageSummary' | 'performanceAssessment' | 'nextSubjectFocus',
    val: string
  ) => {
    setForm((prev) => ({
      ...prev,
      subjectAssessments: prev.subjectAssessments.map((item, i) =>
        i === idx ? { ...item, [key]: val } : item
      ),
    }));
  };

  const handleDownloadPdf = () => {
    downloadMonthlyReportPdf(
      {
        ...form,
        status: savedReport?.status ?? MonthlyReportStatus.DRAFT,
        approvedAt: savedReport?.approvedAt,
      },
      teacherName
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Monthly Reports
          </button>

          {onOpenStudent && (
            <button
              type="button"
              onClick={() => onOpenStudent(studentId)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Open {form.studentName} Profile
            </button>
          )}
        </div>

        <div className={`${CARD_CLASS} p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {form.studentName} · {form.reportingMonthLabel}
              </h1>
              {savedReport ? (
                <span
                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getMonthlyReportStatusClass(
                    savedReport.status
                  )}`}
                >
                  {isApproved ? 'Approved' : 'Saved Draft'}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md border bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30">
                  Unsaved AI Draft
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
              {form.completedClassesCount} completed{' '}
              {form.completedClassesCount === 1 ? 'class' : 'classes'} ·{' '}
              {form.totalInstructionMinutes} min · {form.homeworkCompletedCount}/
              {form.homeworkAssignedCount} homework completed ·{' '}
              {form.approvedAiReportsCount} approved class AI reports
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isApproved && (
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    viewMode === 'edit'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    viewMode === 'preview'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              </div>
            )}

            {!isApproved && onRegenerate && (
              <button
                type="button"
                disabled={regenerating || Boolean(savingAction)}
                onClick={() => void onRegenerate()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25 border border-violet-200/80 dark:border-violet-500/30 rounded-xl transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {regenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Regenerate
              </button>
            )}

            {!isApproved && (
              <button
                type="button"
                disabled={regenerating || Boolean(savingAction)}
                onClick={() => void persist(MonthlyReportStatus.DRAFT)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap disabled:opacity-60"
              >
                {savingAction === 'draft' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save as Draft
              </button>
            )}

            {!isApproved && (
              <button
                type="button"
                disabled={regenerating || Boolean(savingAction)}
                onClick={() => setApproveConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-xs transition-all whitespace-nowrap disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve Report
              </button>
            )}

            {isApproved && (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Report
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </button>
              </>
            )}

            {savedReport && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-xl transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>

        {form.completedClassesCount === 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Zero completed class documentation records were found for {form.studentName} in{' '}
              {form.reportingMonthLabel}. Cancelled lessons and incomplete drafts are excluded.
              Review carefully before saving or approving.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
      </div>

      {/* Preview / Approved Document View */}
      {(isApproved || viewMode === 'preview') && (
        <MonthlyReportDocumentView
          report={{
            ...form,
            status: savedReport?.status ?? MonthlyReportStatus.DRAFT,
            approvedAt: savedReport?.approvedAt,
          }}
          teacherName={teacherName}
        />
      )}

      {/* Full Editable Report Form (Draft / Unsaved AI Draft) */}
      {!isApproved && viewMode === 'edit' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void persist(MonthlyReportStatus.DRAFT);
          }}
          className="no-print space-y-6"
        >
          {/* Section A: Student Information */}
          <section className={`${CARD_CLASS} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                A
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Student Information
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Original class documentation remains untouched when editing or approving this monthly summary.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.studentNameMax}
                  value={form.studentName}
                  onChange={(e) => setForm({ ...form, studentName: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Grade &amp; Age
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.gradeAndAgeMax}
                  value={form.gradeAndAge}
                  onChange={(e) => setForm({ ...form, gradeAndAge: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Reporting Month *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.reportingMonthLabelMax}
                  value={form.reportingMonthLabel}
                  onChange={(e) => setForm({ ...form, reportingMonthLabel: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Subjects Covered *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.subjectsCoveredMax}
                  value={form.subjectsCovered}
                  onChange={(e) => setForm({ ...form, subjectsCovered: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* Section B: Academic Activities and Coverage */}
          <section className={`${CARD_CLASS} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                B
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Academic Activities and Coverage
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Topics Covered During the Month
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.topicsCoveredMax}
                  value={form.topicsCovered}
                  onChange={(e) => setForm({ ...form, topicsCovered: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Skills and Concepts Introduced
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.skillsAndConceptsIntroducedMax}
                  value={form.skillsAndConceptsIntroduced}
                  onChange={(e) =>
                    setForm({ ...form, skillsAndConceptsIntroduced: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Practical Activities and Projects Completed
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.practicalActivitiesAndProjectsMax}
                  value={form.practicalActivitiesAndProjects}
                  onChange={(e) =>
                    setForm({ ...form, practicalActivitiesAndProjects: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Learning Objectives Achieved
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.learningObjectivesAchievedMax}
                  value={form.learningObjectivesAchieved}
                  onChange={(e) =>
                    setForm({ ...form, learningObjectivesAchieved: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* Section C: Academic Performance & Subject Evaluations */}
          <section className={`${CARD_CLASS} p-6 space-y-5`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                C
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Academic Performance
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Understanding of Concepts
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.conceptUnderstandingMax}
                  value={form.conceptUnderstanding}
                  onChange={(e) => setForm({ ...form, conceptUnderstanding: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Ability to Apply What Was Taught
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.applicationOfLearningMax}
                  value={form.applicationOfLearning}
                  onChange={(e) => setForm({ ...form, applicationOfLearning: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Participation and Engagement
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.participationAndEngagementMax}
                  value={form.participationAndEngagement}
                  onChange={(e) =>
                    setForm({ ...form, participationAndEngagement: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Areas of Strength
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.areasOfStrengthMax}
                  value={form.areasOfStrength}
                  onChange={(e) => setForm({ ...form, areasOfStrength: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Areas Requiring Further Development
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.areasRequiringDevelopmentMax}
                  value={form.areasRequiringDevelopment}
                  onChange={(e) =>
                    setForm({ ...form, areasRequiringDevelopment: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {form.subjectAssessments.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Subject-Specific Assessments
                </h3>
                <div
                  className={`grid grid-cols-1 ${
                    form.subjectAssessments.length > 1 ? 'xl:grid-cols-2' : ''
                  } gap-4`}
                >
                  {form.subjectAssessments.map((sa, idx) => (
                    <div
                      key={sa.subject}
                      className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getSubjectBadgeClass(
                            sa.subject as Subject
                          )}`}
                        >
                          {sa.subject}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {sa.classesCompletedCount} completed{' '}
                          {sa.classesCompletedCount === 1 ? 'class' : 'classes'}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                          Subject Criteria Focus
                        </label>
                        <input
                          type="text"
                          maxLength={BLUEPRINT_LIMITS.monthlyReport.subjectCriteriaFocusMax}
                          value={sa.criteriaFocus}
                          onChange={(e) =>
                            updateSubjectField(idx, 'criteriaFocus', e.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                          Coverage Summary
                        </label>
                        <textarea
                          rows={3}
                          maxLength={BLUEPRINT_LIMITS.monthlyReport.subjectCoverageSummaryMax}
                          value={sa.coverageSummary}
                          onChange={(e) =>
                            updateSubjectField(idx, 'coverageSummary', e.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                          Performance Assessment
                        </label>
                        <textarea
                          rows={3}
                          maxLength={BLUEPRINT_LIMITS.monthlyReport.subjectPerformanceAssessmentMax}
                          value={sa.performanceAssessment}
                          onChange={(e) =>
                            updateSubjectField(idx, 'performanceAssessment', e.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                          Next Learning Focus
                        </label>
                        <textarea
                          rows={2}
                          maxLength={BLUEPRINT_LIMITS.monthlyReport.subjectNextFocusMax}
                          value={sa.nextSubjectFocus}
                          onChange={(e) =>
                            updateSubjectField(idx, 'nextSubjectFocus', e.target.value)
                          }
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Section D: Homework and Assessment */}
          <section className={`${CARD_CLASS} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                D
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Homework and Assessment
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Homework Assigned
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.homeworkAssignedSummaryMax}
                  value={form.homeworkAssignedSummary}
                  onChange={(e) =>
                    setForm({ ...form, homeworkAssignedSummary: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Completed and Outstanding
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.homeworkCompletionStatusMax}
                  value={form.homeworkCompletionStatus}
                  onChange={(e) =>
                    setForm({ ...form, homeworkCompletionStatus: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Assessment Results &amp; Feedback
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.assessmentResultsAndFeedbackMax}
                  value={form.assessmentResultsAndFeedback}
                  onChange={(e) =>
                    setForm({ ...form, assessmentResultsAndFeedback: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* Section E: Challenges and Areas for Improvement */}
          <section className={`${CARD_CLASS} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                E
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Challenges and Areas for Improvement
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Specific Difficulties Observed
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.specificDifficultiesObservedMax}
                  value={form.specificDifficultiesObserved}
                  onChange={(e) =>
                    setForm({ ...form, specificDifficultiesObserved: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Concepts Needing Revision
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.conceptsNeedingRevisionMax}
                  value={form.conceptsNeedingRevision}
                  onChange={(e) =>
                    setForm({ ...form, conceptsNeedingRevision: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Skills Requiring More Practice
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.skillsRequiringPracticeMax}
                  value={form.skillsRequiringPractice}
                  onChange={(e) =>
                    setForm({ ...form, skillsRequiringPractice: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* Section F: Teacher's Remarks */}
          <section className={`${CARD_CLASS} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                F
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Teacher&apos;s Remarks
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Overall Monthly Assessment
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.overallMonthlyAssessmentMax}
                  value={form.overallMonthlyAssessment}
                  onChange={(e) =>
                    setForm({ ...form, overallMonthlyAssessment: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Progress Made During the Month
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.progressMadeDuringMonthMax}
                  value={form.progressMadeDuringMonth}
                  onChange={(e) =>
                    setForm({ ...form, progressMadeDuringMonth: e.target.value })
                  }
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                  Recommended Approach &amp; Next Targets
                </label>
                <textarea
                  rows={4}
                  maxLength={BLUEPRINT_LIMITS.monthlyReport.recommendedTeachingApproachAndTargetsMax}
                  value={form.recommendedTeachingApproachAndTargets}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      recommendedTeachingApproachAndTargets: e.target.value,
                    })
                  }
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </section>

          {/* Section G: Conclusion & Action Footer */}
          <section className={`${CARD_CLASS} p-6 space-y-4`}>
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                G
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Conclusion
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">
                Concise Summary of Monthly Progress
              </label>
              <textarea
                rows={3}
                maxLength={BLUEPRINT_LIMITS.monthlyReport.conclusionMax}
                value={form.conclusion}
                onChange={(e) => setForm({ ...form, conclusion: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {onRegenerate && (
                  <button
                    type="button"
                    disabled={regenerating || Boolean(savingAction)}
                    onClick={() => void onRegenerate()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate Report
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="submit"
                  disabled={regenerating || Boolean(savingAction)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {savingAction === 'draft' ? 'Saving Draft...' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  disabled={regenerating || Boolean(savingAction)}
                  onClick={() => setApproveConfirmOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-xs transition-all disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingAction === 'approve' ? 'Approving...' : 'Approve Report'}
                </button>
              </div>
            </div>
          </section>
        </form>
      )}

      <ConfirmDialog
        open={approveConfirmOpen}
        title="Approve monthly academic progress report?"
        description={`Approving finalizes ${form.studentName}'s ${form.reportingMonthLabel} progress report for PDF export and printing. Your original class documentation remains unchanged.`}
        confirmLabel="Approve Report"
        tone="primary"
        busy={savingAction === 'approve'}
        onConfirm={() => void persist(MonthlyReportStatus.APPROVED)}
        onCancel={() => setApproveConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete monthly progress report?"
        description={`Delete the monthly progress report for ${savedReport?.studentName ?? ''} (${savedReport?.reportingMonthLabel ?? ''})? Original class documentation and homework records will not be affected.`}
        confirmLabel="Delete Report"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
