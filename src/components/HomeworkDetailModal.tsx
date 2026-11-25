import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  FileCheck,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  formatHomeworkStatusLabel,
  getEffectiveHomeworkStatus,
  HomeworkLinkKind,
  HomeworkStatus,
  type CanonicalHomeworkStatus,
  type ClassReport,
  type Homework,
  type HomeworkLink,
  type LessonPlan,
} from '../types/teaching';
import { sanitizeHttpUrl, todayIsoDate, updateHomework } from '../lib/firestoreService';
import {
  getHomeworkStatusClass,
  getStudentAvatarGradient,
  getStudentInitials,
  getSubjectBadgeClass,
  INPUT_CLASS,
} from '../lib/uiTokens';
import {
  HomeworkLinkBadges,
  HomeworkLinkListEditor,
} from './HomeworkLinkListEditor';

interface HomeworkDetailModalProps {
  item: Homework | null;
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  onClose: () => void;
  onEditAssignment: (item: Homework) => void;
  onDeleteRequest: (item: Homework) => void;
  onOpenStudent?: (studentId: string) => void;
}

const STATUS_PROGRESSION: Array<{ value: CanonicalHomeworkStatus; label: string }> = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

export function HomeworkDetailModal({
  item,
  lessonPlans,
  classReports,
  onClose,
  onEditAssignment,
  onDeleteRequest,
  onOpenStudent,
}: HomeworkDetailModalProps) {
  const [status, setStatus] = useState<HomeworkStatus>(HomeworkStatus.ASSIGNED);
  const [submittedDate, setSubmittedDate] = useState('');
  const [studentWorkSummary, setStudentWorkSummary] = useState('');
  const [submissionLinks, setSubmissionLinks] = useState<HomeworkLink[]>([]);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [areasForImprovement, setAreasForImprovement] = useState('');

  const [draftLinkTitle, setDraftLinkTitle] = useState('');
  const [draftLinkUrl, setDraftLinkUrl] = useState('');
  const [draftLinkKind, setDraftLinkKind] = useState<HomeworkLinkKind>(
    HomeworkLinkKind.GOOGLE_DOC
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (!item) return;
    setError(null);
    setSavedBanner(false);
    setDraftLinkTitle('');
    setDraftLinkUrl('');
    setDraftLinkKind(HomeworkLinkKind.GOOGLE_DOC);

    setStatus(getEffectiveHomeworkStatus(item) as HomeworkStatus);
    setSubmittedDate(item.submittedDate ?? '');
    setStudentWorkSummary(item.studentWorkSummary ?? '');
    setSubmissionLinks(item.submissionLinks ?? []);
    setScore(item.score ?? '');
    setFeedback(item.feedback ?? '');
    setAreasForImprovement(item.areasForImprovement ?? '');
  }, [item]);

  if (!item) return null;

  const today = todayIsoDate();
  const effectiveStatus = getEffectiveHomeworkStatus(item, today);
  const relatedPlan = item.lessonPlanId
    ? lessonPlans.find((p) => p.id === item.lessonPlanId)
    : undefined;
  const relatedReport = item.classReportId
    ? classReports.find((r) => r.id === item.classReportId)
    : undefined;

  const handleStatusSelect = (nextStatus: CanonicalHomeworkStatus) => {
    setStatus(nextStatus as HomeworkStatus);
    setSavedBanner(false);
    if (
      (nextStatus === 'submitted' ||
        nextStatus === 'under_review' ||
        nextStatus === 'completed') &&
      !submittedDate
    ) {
      setSubmittedDate(todayIsoDate());
    }
  };

  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedBanner(false);

    let finalSubmissionLinks = [...submissionLinks];
    if (draftLinkUrl.trim()) {
      const safeUrl = sanitizeHttpUrl(draftLinkUrl);
      if (!safeUrl || safeUrl.length < 8) {
        setError('Submitted work link must start with https:// or http://');
        return;
      }
      if (finalSubmissionLinks.length >= BLUEPRINT_LIMITS.homework.maxLinks) {
        setError(`Maximum of ${BLUEPRINT_LIMITS.homework.maxLinks} submission links allowed.`);
        return;
      }
      finalSubmissionLinks.push({
        title:
          draftLinkTitle.trim().slice(0, BLUEPRINT_LIMITS.homework.linkTitleMax) ||
          'Student Work Link',
        url: safeUrl,
        kind: draftLinkKind,
      });
    }

    setSaving(true);
    try {
      await updateHomework(item.id, {
        status,
        submittedDate,
        studentWorkSummary,
        submissionLinks: finalSubmissionLinks,
        score,
        feedback,
        areasForImprovement,
      });
      setSubmissionLinks(finalSubmissionLinks);
      setDraftLinkTitle('');
      setDraftLinkUrl('');
      setSavedBanner(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save submission and assessment.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="homework-detail-title"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl my-8 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-orange-50/70 via-blue-50/50 to-indigo-50/60 dark:from-orange-500/10 dark:via-blue-500/10 dark:to-indigo-500/10 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                item.studentName
              )} text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}
            >
              {getStudentInitials(item.studentName)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="homework-detail-title"
                  className="text-lg font-bold text-slate-900 dark:text-white"
                >
                  {item.title}
                </h2>
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getHomeworkStatusClass(
                    effectiveStatus
                  )}`}
                >
                  {formatHomeworkStatusLabel(effectiveStatus)}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                    item.subject
                  )}`}
                >
                  {item.subject}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {onOpenStudent ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStudent(item.studentId);
                    }}
                    className="font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {item.studentName}
                  </button>
                ) : (
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {item.studentName}
                  </span>
                )}
                {item.assignedDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Assigned {item.assignedDate}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span
                  className={`font-mono tabular-nums font-medium ${
                    effectiveStatus === 'overdue'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Due {item.dueDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditAssignment(item)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Assignment
            </button>
            <button
              type="button"
              onClick={() => onDeleteRequest(item)}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              aria-label="Close homework details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {/* Assignment Brief */}
          <section className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Assignment Details
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {relatedPlan && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-violet-50 text-violet-700 border border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30">
                    <CalendarClock className="w-3 h-3" />
                    Lesson Plan: {relatedPlan.topic}
                  </span>
                )}
                {relatedReport && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-teal-50 text-teal-700 border border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30">
                    <ClipboardCheck className="w-3 h-3" />
                    Class: {relatedReport.topic}
                  </span>
                )}
              </div>
            </div>

            {effectiveStatus === 'overdue' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This assignment passed its due date ({item.dueDate}) and has not been completed yet.
              </div>
            )}

            {item.instructions?.trim() ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Instructions
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {item.instructions}
                </p>
              </div>
            ) : null}

            {item.questionsOrTasks?.trim() ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Questions / Tasks
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {item.questionsOrTasks}
                </p>
              </div>
            ) : null}

            {!item.instructions?.trim() && !item.questionsOrTasks?.trim() && (
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No written instructions or questions added.
              </p>
            )}

            {item.supportingLinks && item.supportingLinks.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Supporting Resources &amp; Links
                </p>
                <HomeworkLinkBadges links={item.supportingLinks} />
              </div>
            )}
          </section>

          {/* Submission & Teacher Assessment Form */}
          <form onSubmit={handleSaveAssessment} className="space-y-5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Submission &amp; Assessment
                </h3>
              </div>
              {savedBanner && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}

            {/* Status Progression Bar */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Assignment Progress Status
              </label>
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/70 dark:border-slate-800">
                {STATUS_PROGRESSION.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusSelect(opt.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                      status === opt.value
                        ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs ring-1 ring-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submission Date & Score */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Submission Date
                  </span>
                </label>
                <input
                  type="date"
                  value={submittedDate}
                  onChange={(e) => setSubmittedDate(e.target.value)}
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Score or Assessment
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.homework.scoreMax}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g., 9/10, 92%, Strong Effort, Mastered"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Student Work Summary */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Student&apos;s Answers or Work Summary
              </label>
              <textarea
                rows={3}
                maxLength={BLUEPRINT_LIMITS.homework.studentWorkSummaryMax}
                value={studentWorkSummary}
                onChange={(e) => setStudentWorkSummary(e.target.value)}
                placeholder="Summarize the student's answers, code submitted, or completed exercises..."
                className={INPUT_CLASS}
              />
            </div>

            {/* Uploaded Work / Submission Links */}
            <HomeworkLinkListEditor
              label="Uploaded Work or Supporting Submission Links"
              helperText="Attach links to the student's submitted Google Doc, Miro board, Scratch project, or YouTube demo."
              links={submissionLinks}
              onChange={setSubmissionLinks}
              draftTitle={draftLinkTitle}
              onDraftTitleChange={setDraftLinkTitle}
              draftUrl={draftLinkUrl}
              onDraftUrlChange={setDraftLinkUrl}
              draftKind={draftLinkKind}
              onDraftKindChange={setDraftLinkKind}
            />

            {/* Teacher Feedback & Areas Requiring Improvement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Teacher&apos;s Feedback
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.homework.feedbackMax}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Specific praise, observations, and review comments..."
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Areas Requiring Improvement
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.homework.areasForImprovementMax}
                  value={areasForImprovement}
                  onChange={(e) => setAreasForImprovement(e.target.value)}
                  placeholder="Concepts to revisit, mistakes to review, or follow-up steps..."
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Submission & Assessment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
