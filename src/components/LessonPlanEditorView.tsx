import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  FileText,
  Target,
  Trash2,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  formatLessonStatusLabel,
  isScheduledLessonStatus,
  LessonPlanStatus,
  StudentStatus,
  Subject,
  type LessonPlan,
  type Student,
} from '../types/teaching';
import {
  createHomework,
  createLessonPlan,
  todayIsoDate,
  updateLessonPlan,
} from '../lib/firestoreService';
import {
  CARD_CLASS,
  getLessonStatusClass,
  getSubjectBadgeClass,
  INPUT_CLASS,
} from '../lib/uiTokens';

export type EditorMode = 'view' | 'edit' | 'create' | 'duplicate';

interface LessonPlanEditorViewProps {
  teacherId: string;
  students: Student[];
  initialMode: EditorMode;
  plan?: LessonPlan | null;
  preselectedStudent?: Student | null;
  initialError?: string | null;
  onBack: () => void;
  onSaved: (savedPlanId?: string) => void;
  onDuplicate: (plan: LessonPlan) => void;
  onDeleteRequest: (plan: LessonPlan) => void;
  onStartClassFromPlan: (plan: LessonPlan) => void;
}

interface FormState {
  studentId: string;
  subject: Subject;
  topic: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: string;
  status: LessonPlanStatus;
  learningObjectives: string;
  previousKnowledge: string;
  lessonIntroduction: string;
  teachingMaterials: string;
  activities: string;
  practicalExercises: string;
  classwork: string;
  homework: string;
  expectedOutcomes: string;
  alsoAssignHomework: boolean;
}

function getAllowedSubjectsForStudent(student: Student | undefined): Subject[] {
  if (!student || student.subjects.length === 0) {
    return [Subject.MATHEMATICS, Subject.TECHNOLOGY];
  }
  return student.subjects;
}

function normalizeStatusForForm(status: LessonPlanStatus): LessonPlanStatus {
  if (status === LessonPlanStatus.UPCOMING) {
    return LessonPlanStatus.SCHEDULED;
  }
  return status;
}

function buildFormState(
  mode: EditorMode,
  students: Student[],
  plan?: LessonPlan | null,
  preselectedStudent?: Student | null
): FormState {
  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const defaultStudent = preselectedStudent ?? activeStudents[0] ?? students[0];

  if (plan && (mode === 'edit' || mode === 'view' || mode === 'duplicate')) {
    const linkedStudent = students.find((s) => s.id === plan.studentId) ?? defaultStudent;
    const allowedSubjects = getAllowedSubjectsForStudent(linkedStudent);
    const resolvedSubject = allowedSubjects.includes(plan.subject)
      ? plan.subject
      : allowedSubjects[0];

    return {
      studentId: linkedStudent?.id ?? plan.studentId,
      subject: resolvedSubject,
      topic: mode === 'duplicate' ? `${plan.topic} (Copy)` : plan.topic,
      scheduledDate: mode === 'duplicate' ? todayIsoDate() : plan.scheduledDate,
      scheduledTime: plan.scheduledTime ?? '',
      durationMinutes: String(plan.durationMinutes ?? 45),
      status:
        mode === 'duplicate'
          ? LessonPlanStatus.SCHEDULED
          : normalizeStatusForForm(plan.status),
      learningObjectives: plan.learningObjectives ?? '',
      previousKnowledge: plan.previousKnowledge ?? '',
      lessonIntroduction: plan.lessonIntroduction ?? '',
      teachingMaterials: plan.teachingMaterials ?? '',
      activities: plan.activities ?? '',
      practicalExercises: plan.practicalExercises ?? '',
      classwork: plan.classwork ?? '',
      homework: plan.homework ?? '',
      expectedOutcomes: plan.expectedOutcomes ?? '',
      alsoAssignHomework: false,
    };
  }

  const allowedSubjects = getAllowedSubjectsForStudent(defaultStudent);
  return {
    studentId: defaultStudent?.id ?? '',
    subject: allowedSubjects[0],
    topic: '',
    scheduledDate: todayIsoDate(),
    scheduledTime: '',
    durationMinutes: '45',
    status: LessonPlanStatus.SCHEDULED,
    learningObjectives: '',
    previousKnowledge: '',
    lessonIntroduction: '',
    teachingMaterials: '',
    activities: '',
    practicalExercises: '',
    classwork: '',
    homework: '',
    expectedOutcomes: '',
    alsoAssignHomework: false,
  };
}

export function LessonPlanEditorView({
  teacherId,
  students,
  initialMode,
  plan,
  preselectedStudent,
  initialError,
  onBack,
  onSaved,
  onDuplicate,
  onDeleteRequest,
  onStartClassFromPlan,
}: LessonPlanEditorViewProps) {
  const [mode, setMode] = useState<EditorMode>(initialMode);
  const [form, setForm] = useState<FormState>(() =>
    buildFormState(initialMode, students, plan, preselectedStudent)
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setForm(buildFormState(initialMode, students, plan, preselectedStudent));
    setError(initialError ?? null);
    setStatusMessage(null);
  }, [initialMode, plan?.id, preselectedStudent?.id, initialError]);

  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const selectableStudents =
    mode === 'edit' || mode === 'view'
      ? students
      : activeStudents.length > 0
      ? activeStudents
      : students;

  const selectedStudent = students.find((s) => s.id === form.studentId);
  const allowedSubjects = getAllowedSubjectsForStudent(selectedStudent);

  const handleStudentChange = (nextStudentId: string) => {
    const nextStudent = students.find((s) => s.id === nextStudentId);
    const nextAllowed = getAllowedSubjectsForStudent(nextStudent);
    setForm((prev) => ({
      ...prev,
      studentId: nextStudentId,
      subject: nextAllowed.includes(prev.subject) ? prev.subject : nextAllowed[0],
    }));
  };

  const handlePersist = async (targetStatus: LessonPlanStatus) => {
    setError(null);
    setStatusMessage(null);

    const student = students.find((s) => s.id === form.studentId);
    if (!student) {
      setError('Please select a student for this lesson plan.');
      return;
    }
    if (!allowedSubjects.includes(form.subject)) {
      setError(`Subject must match ${student.fullName}'s assigned subjects.`);
      return;
    }
    if (!form.topic.trim()) {
      setError('Lesson topic is required.');
      return;
    }
    if (!BLUEPRINT_LIMITS.datePattern.test(form.scheduledDate.trim())) {
      setError('Please choose a valid lesson date.');
      return;
    }

    const parsedDuration = Number(form.durationMinutes.trim());
    if (
      !form.durationMinutes.trim() ||
      Number.isNaN(parsedDuration) ||
      parsedDuration < 1 ||
      parsedDuration > BLUEPRINT_LIMITS.lessonPlan.durationMax
    ) {
      setError(
        `Lesson duration must be between 1 and ${BLUEPRINT_LIMITS.lessonPlan.durationMax} minutes.`
      );
      return;
    }

    const requiresCoreSections =
      targetStatus !== LessonPlanStatus.DRAFT &&
      targetStatus !== LessonPlanStatus.CANCELLED;

    if (requiresCoreSections) {
      if (!form.learningObjectives.trim()) {
        setError(
          'Learning objectives are required before scheduling or completing a lesson plan. You can save as a draft instead.'
        );
        return;
      }
      if (!form.activities.trim()) {
        setError(
          'Step-by-step lesson activities are required before scheduling or completing a lesson plan. You can save as a draft instead.'
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (mode === 'edit' && plan) {
        await updateLessonPlan(plan.id, {
          studentName: student.fullName,
          subject: form.subject,
          topic: form.topic,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          durationMinutes: Math.round(parsedDuration),
          learningObjectives: form.learningObjectives,
          previousKnowledge: form.previousKnowledge,
          lessonIntroduction: form.lessonIntroduction,
          teachingMaterials: form.teachingMaterials,
          activities: form.activities,
          practicalExercises: form.practicalExercises,
          classwork: form.classwork,
          homework: form.homework,
          expectedOutcomes: form.expectedOutcomes,
          status: targetStatus,
        });

        if (form.alsoAssignHomework && form.homework.trim()) {
          await createHomework(teacherId, {
            studentId: student.id,
            studentName: student.fullName,
            subject: form.subject,
            title: `${form.topic.trim()} — Homework`,
            instructions: form.homework.trim(),
            dueDate: form.scheduledDate,
            lessonPlanId: plan.id,
          });
        }

        onSaved(plan.id);
      } else {
        const newPlanId = await createLessonPlan(teacherId, {
          studentId: student.id,
          studentName: student.fullName,
          subject: form.subject,
          topic: form.topic,
          scheduledDate: form.scheduledDate,
          scheduledTime: form.scheduledTime,
          durationMinutes: Math.round(parsedDuration),
          learningObjectives: form.learningObjectives,
          previousKnowledge: form.previousKnowledge,
          lessonIntroduction: form.lessonIntroduction,
          teachingMaterials: form.teachingMaterials,
          activities: form.activities,
          practicalExercises: form.practicalExercises,
          classwork: form.classwork,
          homework: form.homework,
          expectedOutcomes: form.expectedOutcomes,
          status: targetStatus,
        });

        if (form.alsoAssignHomework && form.homework.trim()) {
          await createHomework(teacherId, {
            studentId: student.id,
            studentName: student.fullName,
            subject: form.subject,
            title: `${form.topic.trim()} — Homework`,
            instructions: form.homework.trim(),
            dueDate: form.scheduledDate,
            lessonPlanId: newPlanId,
          });
        }

        onSaved(newPlanId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save lesson plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusUpdate = async (nextStatus: LessonPlanStatus) => {
    if (!plan) return;
    setError(null);
    setStatusMessage(null);

    if (
      nextStatus !== LessonPlanStatus.DRAFT &&
      nextStatus !== LessonPlanStatus.CANCELLED &&
      (!plan.learningObjectives.trim() || !plan.activities.trim())
    ) {
      setMode('edit');
      setForm((prev) => ({ ...prev, status: nextStatus }));
      setError(
        'Add Learning Objectives and Step-by-step Lesson Activities before marking this draft as scheduled or completed.'
      );
      return;
    }

    setSaving(true);
    try {
      await updateLessonPlan(plan.id, { status: nextStatus });
      setStatusMessage(`Lesson plan marked as ${formatLessonStatusLabel(nextStatus)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update lesson status.');
    } finally {
      setSaving(false);
    }
  };

  // --- READ VIEW ---
  if (mode === 'view' && plan) {
    const detailSections: Array<{ label: string; value?: string }> = [
      { label: 'Learning Objectives', value: plan.learningObjectives },
      { label: 'Previous Knowledge', value: plan.previousKnowledge },
      { label: 'Lesson Introduction', value: plan.lessonIntroduction },
      { label: 'Teaching Materials & Resources', value: plan.teachingMaterials },
      { label: 'Step-by-Step Lesson Activities', value: plan.activities },
      { label: 'Practical Exercises', value: plan.practicalExercises },
      { label: 'Classwork', value: plan.classwork },
      { label: 'Homework', value: plan.homework },
      { label: 'Expected Learning Outcomes', value: plan.expectedOutcomes },
    ];

    return (
      <div className="space-y-6">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Lesson Plans
          </button>

          <div className={`${CARD_CLASS} p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {plan.topic}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${getLessonStatusClass(
                    plan.status
                  )}`}
                >
                  {formatLessonStatusLabel(plan.status)}
                </span>
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${getSubjectBadgeClass(
                    plan.subject
                  )}`}
                >
                  {plan.subject}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex flex-wrap items-center gap-x-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {plan.studentName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{plan.scheduledDate}</span>
                {plan.scheduledTime && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{plan.scheduledTime}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {plan.durationMinutes ?? 45} min
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isScheduledLessonStatus(plan.status) && (
                <button
                  type="button"
                  onClick={() => onStartClassFromPlan(plan)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors whitespace-nowrap"
                >
                  Start Class
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStatusMessage(null);
                  setMode('edit');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                Edit Lesson Plan
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(plan)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => onDeleteRequest(plan)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 rounded-xl transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}
        {statusMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Quick Status Switcher */}
        <div className={`${CARD_CLASS} px-5 py-4 flex flex-wrap items-center justify-between gap-3`}>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Lesson Status
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: LessonPlanStatus.DRAFT, label: 'Draft' },
              { value: LessonPlanStatus.SCHEDULED, label: 'Scheduled' },
              { value: LessonPlanStatus.COMPLETED, label: 'Completed' },
              { value: LessonPlanStatus.CANCELLED, label: 'Cancelled' },
            ].map((opt) => {
              const active =
                opt.value === LessonPlanStatus.SCHEDULED
                  ? isScheduledLessonStatus(plan.status)
                  : plan.status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={saving}
                  onClick={() => void handleQuickStatusUpdate(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap disabled:opacity-60 ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-300 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-[#0E1629] border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* All Lesson Sections */}
        <div className={`${CARD_CLASS} divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden`}>
          {detailSections.map((sec) => (
            <div key={sec.label} className="p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                {sec.label}
              </h2>
              {sec.value?.trim() ? (
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {sec.value}
                </p>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">Not added yet.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- CREATE / EDIT / DUPLICATE FORM ---
  const headingText =
    mode === 'edit'
      ? `Edit Lesson Plan`
      : mode === 'duplicate'
      ? 'Duplicate Lesson Plan'
      : 'Create Lesson Plan';

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => {
            if (mode === 'edit' && plan && initialMode === 'view') {
              setMode('view');
              setError(null);
            } else {
              onBack();
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {mode === 'edit' && plan && initialMode === 'view'
            ? 'Back to Lesson Details'
            : 'Back to Lesson Plans'}
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {headingText}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Select the student and subject, then structure objectives, activities, exercises, and outcomes.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const submitStatus =
            mode !== 'edit' && form.status === LessonPlanStatus.DRAFT
              ? LessonPlanStatus.SCHEDULED
              : form.status;
          void handlePersist(submitStatus);
        }}
        className="space-y-6"
      >
        {/* 1. Lesson Setup */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <CalendarClock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                1. Lesson Setup
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Fields marked * are required to schedule
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="lp-student"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Student *
              </label>
              <select
                id="lp-student"
                required
                disabled={mode === 'edit'}
                value={form.studentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                className={`${INPUT_CLASS} disabled:opacity-60`}
              >
                {selectableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
              {mode === 'edit' && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Linked to {selectedStudent?.fullName ?? plan?.studentName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="lp-subject"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Subject *
              </label>
              <select
                id="lp-subject"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value as Subject })}
                className={INPUT_CLASS}
              >
                {allowedSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
              {selectedStudent && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Assigned: {allowedSubjects.join(' & ')}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="lp-status"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Status
              </label>
              <select
                id="lp-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as LessonPlanStatus })
                }
                className={INPUT_CLASS}
              >
                <option value={LessonPlanStatus.DRAFT}>Draft</option>
                <option value={LessonPlanStatus.SCHEDULED}>Scheduled</option>
                <option value={LessonPlanStatus.COMPLETED}>Completed</option>
                <option value={LessonPlanStatus.CANCELLED}>Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="lp-topic"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Lesson Topic *
              </label>
              <input
                id="lp-topic"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.lessonPlan.topicMax}
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g., Fractions & Equivalent Ratios or Conditionals in Scratch"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="lp-date"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Lesson Date *
              </label>
              <input
                id="lp-date"
                type="date"
                required
                value={form.scheduledDate}
                onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="lp-duration"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Duration (min) *
                </label>
                <input
                  id="lp-duration"
                  type="number"
                  required
                  min={1}
                  max={BLUEPRINT_LIMITS.lessonPlan.durationMax}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
              <div>
                <label
                  htmlFor="lp-time"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Time
                </label>
                <input
                  id="lp-time"
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.lessonPlan.scheduledTimeMax}
                  value={form.scheduledTime}
                  onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                  placeholder="16:00"
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Objectives & Preparation */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                2. Objectives &amp; Preparation
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Define goals, prior knowledge, opening hook, and materials needed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="lp-objectives"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Learning Objectives *
              </label>
              <textarea
                id="lp-objectives"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.learningObjectivesMax}
                value={form.learningObjectives}
                onChange={(e) => setForm({ ...form, learningObjectives: e.target.value })}
                placeholder="What concepts or skills the student will master in this lesson..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="lp-previous-knowledge"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Previous Knowledge
              </label>
              <textarea
                id="lp-previous-knowledge"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.previousKnowledgeMax}
                value={form.previousKnowledge}
                onChange={(e) => setForm({ ...form, previousKnowledge: e.target.value })}
                placeholder="Concepts already covered that this lesson builds upon..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="lp-introduction"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Lesson Introduction
              </label>
              <textarea
                id="lp-introduction"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.lessonIntroductionMax}
                value={form.lessonIntroduction}
                onChange={(e) => setForm({ ...form, lessonIntroduction: e.target.value })}
                placeholder="Warm-up question, quick review, or engaging hook to open the session..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="lp-materials"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Teaching Materials &amp; Resources
              </label>
              <textarea
                id="lp-materials"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.teachingMaterialsMax}
                value={form.teachingMaterials}
                onChange={(e) => setForm({ ...form, teachingMaterials: e.target.value })}
                placeholder="Worksheets, visual aids, Scratch/Python starter files, or manipulatives..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* 3. Activities & Practice */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                3. Lesson Activities &amp; Practice
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Outline step-by-step teaching flow, hands-on drills, and in-class work.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="lp-activities"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Step-by-Step Lesson Activities *
            </label>
            <textarea
              id="lp-activities"
              rows={4}
              maxLength={BLUEPRINT_LIMITS.lessonPlan.activitiesMax}
              value={form.activities}
              onChange={(e) => setForm({ ...form, activities: e.target.value })}
              placeholder="1. Review prior concept (5 min)&#10;2. Guided demonstration (15 min)&#10;3. Interactive problem solving (15 min)..."
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="lp-exercises"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Practical Exercises
              </label>
              <textarea
                id="lp-exercises"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.practicalExercisesMax}
                value={form.practicalExercises}
                onChange={(e) => setForm({ ...form, practicalExercises: e.target.value })}
                placeholder="Guided hands-on coding tasks or worked math problems..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="lp-classwork"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Classwork
              </label>
              <textarea
                id="lp-classwork"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.classworkMax}
                value={form.classwork}
                onChange={(e) => setForm({ ...form, classwork: e.target.value })}
                placeholder="Independent exercises to complete during the class..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* 4. Homework & Expected Outcomes */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                4. Homework &amp; Expected Outcomes
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set post-lesson practice and define observable mastery criteria.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="lp-homework"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Homework
              </label>
              <textarea
                id="lp-homework"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.homeworkMax}
                value={form.homework}
                onChange={(e) => setForm({ ...form, homework: e.target.value })}
                placeholder="Practice assignment for after class..."
                className={INPUT_CLASS}
              />
              {form.homework.trim() && mode !== 'edit' && (
                <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.alsoAssignHomework}
                    onChange={(e) =>
                      setForm({ ...form, alsoAssignHomework: e.target.checked })
                    }
                    className="accent-blue-600"
                  />
                  Also add to Homework Management for {selectedStudent?.fullName ?? 'student'}
                </label>
              )}
            </div>

            <div>
              <label
                htmlFor="lp-outcomes"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Expected Learning Outcomes
              </label>
              <textarea
                id="lp-outcomes"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.lessonPlan.expectedOutcomesMax}
                value={form.expectedOutcomes}
                onChange={(e) => setForm({ ...form, expectedOutcomes: e.target.value })}
                placeholder="Observable signs that the student understood the lesson..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Form Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (mode === 'edit' && plan && initialMode === 'view') {
                setMode('view');
                setError(null);
              } else {
                onBack();
              }
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handlePersist(LessonPlanStatus.DRAFT)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/25 rounded-xl transition-colors disabled:opacity-60"
            >
              <FileText className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving
                ? 'Saving...'
                : mode === 'edit'
                ? `Save (${formatLessonStatusLabel(form.status)})`
                : form.status === LessonPlanStatus.DRAFT
                ? 'Save & Schedule'
                : `Save (${formatLessonStatusLabel(form.status)})`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
