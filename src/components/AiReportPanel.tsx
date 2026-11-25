import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  Subject,
  type AiReportDraft,
  type ApprovedAiReport,
  type ClassReport,
} from '../types/teaching';
import {
  generateAiClassReport,
  hasSubstantiveDocumentation,
} from '../lib/aiReportService';
import {
  createApprovedAiReport,
  deleteApprovedAiReport,
  updateApprovedAiReport,
} from '../lib/firestoreService';
import { CARD_CLASS, INPUT_CLASS } from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';

interface AiReportPanelProps {
  teacherId: string;
  classReport: ClassReport;
  approvedAiReports: ApprovedAiReport[];
  autoGenerateSignal?: number;
  initialApprovedReportId?: string | null;
  onClearInitialApprovedReportId?: () => void;
  hasUnsavedClassEdits?: boolean;
}

const REPORT_TEXT_FIELDS: Array<{
  key: keyof Pick<
    AiReportDraft,
    | 'learningObjectivesCovered'
    | 'conceptsTaught'
    | 'activitiesAndExercisesCompleted'
    | 'studentParticipation'
    | 'demonstratedUnderstanding'
    | 'areasRequiringImprovement'
    | 'challengesEncountered'
    | 'homeworkAssigned'
    | 'teacherObservations'
    | 'recommendedNextSteps'
  >;
  label: string;
  maxLength: number;
  rows: number;
}> = [
  {
    key: 'learningObjectivesCovered',
    label: 'Learning Objectives Covered',
    maxLength: BLUEPRINT_LIMITS.aiReport.learningObjectivesCoveredMax,
    rows: 2,
  },
  {
    key: 'conceptsTaught',
    label: 'Concepts Taught',
    maxLength: BLUEPRINT_LIMITS.aiReport.conceptsTaughtMax,
    rows: 3,
  },
  {
    key: 'activitiesAndExercisesCompleted',
    label: 'Activities & Exercises Completed',
    maxLength: BLUEPRINT_LIMITS.aiReport.activitiesAndExercisesCompletedMax,
    rows: 3,
  },
  {
    key: 'studentParticipation',
    label: 'Student Participation',
    maxLength: BLUEPRINT_LIMITS.aiReport.studentParticipationMax,
    rows: 2,
  },
  {
    key: 'demonstratedUnderstanding',
    label: 'Demonstrated Understanding',
    maxLength: BLUEPRINT_LIMITS.aiReport.demonstratedUnderstandingMax,
    rows: 3,
  },
  {
    key: 'areasRequiringImprovement',
    label: 'Areas Requiring Improvement',
    maxLength: BLUEPRINT_LIMITS.aiReport.areasRequiringImprovementMax,
    rows: 3,
  },
  {
    key: 'challengesEncountered',
    label: 'Challenges Encountered',
    maxLength: BLUEPRINT_LIMITS.aiReport.challengesEncounteredMax,
    rows: 2,
  },
  {
    key: 'homeworkAssigned',
    label: 'Homework Assigned',
    maxLength: BLUEPRINT_LIMITS.aiReport.homeworkAssignedMax,
    rows: 2,
  },
  {
    key: 'teacherObservations',
    label: "Teacher's Observations",
    maxLength: BLUEPRINT_LIMITS.aiReport.teacherObservationsMax,
    rows: 3,
  },
  {
    key: 'recommendedNextSteps',
    label: 'Recommended Next Steps',
    maxLength: BLUEPRINT_LIMITS.aiReport.recommendedNextStepsMax,
    rows: 3,
  },
];

function toDraftFromApproved(rep: ApprovedAiReport): AiReportDraft {
  return {
    studentName: rep.studentName,
    subject: rep.subject,
    lessonTopic: rep.lessonTopic,
    dateAndDuration: rep.dateAndDuration,
    learningObjectivesCovered: rep.learningObjectivesCovered,
    conceptsTaught: rep.conceptsTaught,
    activitiesAndExercisesCompleted: rep.activitiesAndExercisesCompleted,
    studentParticipation: rep.studentParticipation,
    demonstratedUnderstanding: rep.demonstratedUnderstanding,
    areasRequiringImprovement: rep.areasRequiringImprovement,
    challengesEncountered: rep.challengesEncountered,
    homeworkAssigned: rep.homeworkAssigned,
    teacherObservations: rep.teacherObservations,
    recommendedNextSteps: rep.recommendedNextSteps,
  };
}

export function AiReportPanel({
  teacherId,
  classReport,
  approvedAiReports,
  autoGenerateSignal = 0,
  initialApprovedReportId,
  onClearInitialApprovedReportId,
  hasUnsavedClassEdits = false,
}: AiReportPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [savingApproved, setSavingApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [draftForm, setDraftForm] = useState<AiReportDraft | null>(null);
  const [editingApprovedId, setEditingApprovedId] = useState<string | null>(null);
  const [viewingApprovedId, setViewingApprovedId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ApprovedAiReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  const substantiveReady = hasSubstantiveDocumentation(classReport);

  useEffect(() => {
    setDraftForm(null);
    setEditingApprovedId(null);
    setViewingApprovedId(null);
    setError(null);
    setMessage(null);
  }, [classReport.id]);

  useEffect(() => {
    if (!initialApprovedReportId) return;
    const match = approvedAiReports.find((r) => r.id === initialApprovedReportId);
    if (match) {
      setDraftForm(null);
      setEditingApprovedId(null);
      setViewingApprovedId(match.id);
      setError(null);
      onClearInitialApprovedReportId?.();
    }
  }, [initialApprovedReportId, approvedAiReports, onClearInitialApprovedReportId]);

  const runGenerate = async () => {
    setError(null);
    setMessage(null);

    if (!hasSubstantiveDocumentation(classReport)) {
      setError(
        'This saved class record does not have any teaching details yet. Save lesson objectives, concepts taught, activities, or observations before generating an AI report.'
      );
      return;
    }

    setGenerating(true);
    try {
      const generated = await generateAiClassReport(classReport);
      setDraftForm(generated);
      setViewingApprovedId(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate AI report right now. Please try again.'
      );
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (autoGenerateSignal > 0) {
      setEditingApprovedId(null);
      void runGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateSignal]);

  const handleSaveApproved = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftForm) return;

    setError(null);
    setMessage(null);

    if (
      !draftForm.studentName.trim() ||
      !draftForm.lessonTopic.trim() ||
      !draftForm.dateAndDuration.trim()
    ) {
      setError('Student name, lesson topic, and date & duration are required.');
      return;
    }

    setSavingApproved(true);
    try {
      if (editingApprovedId) {
        await updateApprovedAiReport(editingApprovedId, {
          ...draftForm,
          sessionDate: classReport.sessionDate,
        });
        setViewingApprovedId(editingApprovedId);
        setDraftForm(null);
        setEditingApprovedId(null);
        setMessage('Approved AI report updated.');
      } else {
        const newId = await createApprovedAiReport(teacherId, {
          ...draftForm,
          studentId: classReport.studentId,
          classReportId: classReport.id,
          sessionDate: classReport.sessionDate,
        });
        setViewingApprovedId(newId);
        setDraftForm(null);
        setMessage('Approved AI report saved to report history and student profile.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save approved AI report.'
      );
    } finally {
      setSavingApproved(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const wasViewing = viewingApprovedId === deleteTarget.id;
      const wasEditing = editingApprovedId === deleteTarget.id;
      await deleteApprovedAiReport(deleteTarget.id);
      if (wasViewing) setViewingApprovedId(null);
      if (wasEditing) {
        setEditingApprovedId(null);
        setDraftForm(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete approved AI report.'
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const viewingReport = viewingApprovedId
    ? approvedAiReports.find((r) => r.id === viewingApprovedId) ?? null
    : null;

  return (
    <section
      id="ai-report-section"
      className={`${CARD_CLASS} overflow-hidden`}
    >
      {/* Header Bar */}
      <div className="px-6 py-4 bg-gradient-to-r from-violet-50/80 via-blue-50/70 to-indigo-50/50 dark:from-violet-500/15 dark:via-blue-500/10 dark:to-indigo-500/10 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              AI-Generated Class Report
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generates a structured teacher report from this saved class record. You can review, edit, regenerate, and approve without altering the original documentation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingApprovedId(null);
            void runGenerate();
          }}
          disabled={generating || savingApproved || !substantiveReady}
          title={
            substantiveReady
              ? 'Analyze saved class documentation with Gemini AI'
              : 'Save at least one documentation note or objective first'
          }
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate AI Report
            </>
          )}
        </button>
      </div>

      <div className="p-6 space-y-5">
        {hasUnsavedClassEdits && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200">
            You have unsaved edits in the class documentation form above. AI generation uses only the last saved class record—click <strong>Save as Draft</strong> or <strong>Save Changes</strong> first if you want new notes included.
          </div>
        )}

        {!substantiveReady && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
            Add and save at least one teaching detail (such as learning objectives, concepts taught, activities, student responses, or observations) before generating an AI report.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {generating && (
          <div className="p-6 border border-violet-200 dark:border-violet-500/30 bg-violet-50/50 dark:bg-violet-500/10 rounded-xl flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-violet-600 dark:text-violet-400 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Drafting report from saved class documentation...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Organizing lesson coverage, student understanding, challenges, and next steps without adding unrecorded claims.
              </p>
            </div>
          </div>
        )}

        {/* Editable Draft / Approved Edit Form */}
        {draftForm && !generating && (
          <form
            onSubmit={handleSaveApproved}
            className="border border-blue-200 dark:border-blue-500/30 rounded-2xl overflow-hidden bg-white dark:bg-[#0E1629]"
          >
            <div className="px-5 py-3.5 bg-blue-50/80 dark:bg-blue-500/15 border-b border-blue-100 dark:border-blue-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">
                  {editingApprovedId
                    ? 'Editing Approved AI Report'
                    : 'Unapproved AI Draft — Review & Edit'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {editingApprovedId
                    ? 'Edit any section below and save changes. Your original class documentation stays unchanged.'
                    : 'Not saved or approved yet. Correct or rewrite any section before clicking Save Approved Report.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDraftForm(null);
                  setEditingApprovedId(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white self-start sm:self-center"
              >
                <X className="w-4 h-4" />
                Discard
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ai-student-name"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1"
                  >
                    Student Name *
                  </label>
                  <input
                    id="ai-student-name"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.aiReport.studentNameMax}
                    value={draftForm.studentName}
                    onChange={(e) =>
                      setDraftForm({ ...draftForm, studentName: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label
                    htmlFor="ai-subject"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1"
                  >
                    Subject *
                  </label>
                  <select
                    id="ai-subject"
                    value={draftForm.subject}
                    onChange={(e) =>
                      setDraftForm({ ...draftForm, subject: e.target.value as Subject })
                    }
                    className={INPUT_CLASS}
                  >
                    <option value={Subject.MATHEMATICS}>Mathematics</option>
                    <option value={Subject.TECHNOLOGY}>Technology</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ai-lesson-topic"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1"
                  >
                    Lesson Topic *
                  </label>
                  <input
                    id="ai-lesson-topic"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.aiReport.lessonTopicMax}
                    value={draftForm.lessonTopic}
                    onChange={(e) =>
                      setDraftForm({ ...draftForm, lessonTopic: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label
                    htmlFor="ai-date-duration"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1"
                  >
                    Date and Duration *
                  </label>
                  <input
                    id="ai-date-duration"
                    type="text"
                    required
                    maxLength={BLUEPRINT_LIMITS.aiReport.dateAndDurationMax}
                    value={draftForm.dateAndDuration}
                    onChange={(e) =>
                      setDraftForm({ ...draftForm, dateAndDuration: e.target.value })
                    }
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                {REPORT_TEXT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label
                      htmlFor={`ai-${field.key}`}
                      className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1"
                    >
                      {field.label}
                    </label>
                    <textarea
                      id={`ai-${field.key}`}
                      rows={field.rows}
                      maxLength={field.maxLength}
                      value={draftForm[field.key]}
                      onChange={(e) =>
                        setDraftForm({ ...draftForm, [field.key]: e.target.value })
                      }
                      className={`${INPUT_CLASS} leading-relaxed`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 dark:bg-[#131D33] border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={generating || savingApproved || !substantiveReady}
                onClick={() => void runGenerate()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate Report
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={savingApproved}
                  onClick={() => {
                    setDraftForm(null);
                    setEditingApprovedId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingApproved || generating}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  {savingApproved
                    ? 'Saving Approved Report...'
                    : 'Save Approved Report'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Saved Approved Report Read View */}
        {viewingReport && !draftForm && (
          <div className="border border-emerald-200 dark:border-emerald-500/30 rounded-2xl overflow-hidden bg-white dark:bg-[#0E1629]">
            <div className="px-5 py-4 bg-emerald-50/70 dark:bg-emerald-500/15 border-b border-emerald-100 dark:border-emerald-500/20 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved Report
                  </span>
                  <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {viewingReport.lessonTopic}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {viewingReport.studentName} · {viewingReport.subject} ·{' '}
                  {viewingReport.dateAndDuration}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDraftForm(toDraftFromApproved(viewingReport));
                    setEditingApprovedId(viewingReport.id);
                    setViewingApprovedId(null);
                    setMessage(null);
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Report
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(viewingReport)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setViewingApprovedId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Close report view"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {REPORT_TEXT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {field.label}
                  </h4>
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {viewingReport[field.key]?.trim() ||
                      'Not recorded in the class documentation.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved Approved AI Reports List for this Class Record */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Saved Approved Reports for This Class ({approvedAiReports.length})
            </h3>
          </div>

          {approvedAiReports.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No approved AI reports saved for this class record yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {approvedAiReports.map((rep) => {
                const approvedDate = rep.approvedAt?.toDate
                  ? rep.approvedAt.toDate().toLocaleDateString()
                  : rep.sessionDate;
                return (
                  <div
                    key={rep.id}
                    className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white dark:bg-[#0E1629] hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {rep.lessonTopic}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {rep.dateAndDuration} · Approved {approvedDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setDraftForm(null);
                          setEditingApprovedId(null);
                          setViewingApprovedId(rep.id);
                          setMessage(null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingApprovedId(null);
                          setEditingApprovedId(rep.id);
                          setDraftForm(toDraftFromApproved(rep));
                          setMessage(null);
                          setError(null);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(rep)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                        aria-label={`Delete approved report ${rep.lessonTopic}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete approved AI report?"
        description={`Remove the approved AI report for "${deleteTarget?.lessonTopic ?? ''}"? The original class documentation will remain untouched.`}
        confirmLabel="Delete Approved Report"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
