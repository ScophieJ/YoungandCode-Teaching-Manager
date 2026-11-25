import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Compass,
  Edit3,
  FileText,
  MessageSquare,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  ClassReportStatus,
  formatClassStatusLabel,
  isScheduledLessonStatus,
  LessonPlanStatus,
  Subject,
  UnderstandingLevel,
  type ApprovedAiReport,
  type ClassReport,
  type LessonPlan,
  type Student,
} from '../types/teaching';
import { hasSubstantiveDocumentation } from '../lib/aiReportService';
import {
  createHomework,
  updateClassReport,
  updateLessonPlan,
} from '../lib/firestoreService';
import {
  CARD_CLASS,
  getClassReportStatusClass,
  getSubjectBadgeClass,
  getUnderstandingBadgeClass,
  INPUT_CLASS,
} from '../lib/uiTokens';
import { AiReportPanel } from './AiReportPanel';

export type ReportEditorMode = 'view' | 'edit';

interface ClassReportEditorViewProps {
  teacherId: string;
  report: ClassReport;
  student: Student | undefined;
  lessonPlans: LessonPlan[];
  approvedAiReports: ApprovedAiReport[];
  initialMode: ReportEditorMode;
  autoGenerateAiSignal?: number;
  initialApprovedAiReportId?: string | null;
  onClearInitialApprovedAiReportId?: () => void;
  onBack: () => void;
  onDeleteRequest: (report: ClassReport) => void;
  onCompleted?: () => void;
}

interface ReportFormState {
  subject: Subject;
  lessonPlanId: string;
  topic: string;
  sessionDate: string;
  durationMinutes: string;
  understandingLevel: UnderstandingLevel;
  objectivesCovered: string;
  conceptsTaught: string;
  activitiesCompleted: string;
  practicalExercisesPerformed: string;
  classworkGiven: string;
  studentParticipation: string;
  understoodWell: string;
  struggledWith: string;
  challengesEncountered: string;
  homeworkAssigned: string;
  teacherObservations: string;
  recommendationsNextFocus: string;
  alsoAssignHomework: boolean;
}

function getAllowedSubjects(student: Student | undefined): Subject[] {
  if (!student || student.subjects.length === 0) {
    return [Subject.MATHEMATICS, Subject.TECHNOLOGY];
  }
  return student.subjects;
}

function buildReportForm(report: ClassReport, student: Student | undefined): ReportFormState {
  const allowed = getAllowedSubjects(student);
  const resolvedSubject = allowed.includes(report.subject) ? report.subject : allowed[0];

  return {
    subject: resolvedSubject,
    lessonPlanId: report.lessonPlanId ?? '',
    topic: report.topic,
    sessionDate: report.sessionDate,
    durationMinutes: String(report.durationMinutes ?? 45),
    understandingLevel: report.understandingLevel,
    objectivesCovered: report.objectivesCovered ?? '',
    conceptsTaught: report.conceptsTaught ?? '',
    activitiesCompleted: report.activitiesCompleted ?? report.notes ?? '',
    practicalExercisesPerformed: report.practicalExercisesPerformed ?? '',
    classworkGiven: report.classworkGiven ?? '',
    studentParticipation: report.studentParticipation ?? '',
    understoodWell: report.understoodWell ?? '',
    struggledWith: report.struggledWith ?? '',
    challengesEncountered: report.challengesEncountered ?? '',
    homeworkAssigned: report.homeworkAssigned ?? '',
    teacherObservations: report.teacherObservations ?? '',
    recommendationsNextFocus:
      report.recommendationsNextFocus ?? report.progressNotes ?? '',
    alsoAssignHomework: false,
  };
}

export function ClassReportEditorView({
  teacherId,
  report,
  student,
  lessonPlans,
  approvedAiReports,
  initialMode,
  autoGenerateAiSignal = 0,
  initialApprovedAiReportId,
  onClearInitialApprovedAiReportId,
  onBack,
  onDeleteRequest,
  onCompleted,
}: ClassReportEditorViewProps) {
  const [mode, setMode] = useState<ReportEditorMode>(initialMode);
  const [form, setForm] = useState<ReportFormState>(() =>
    buildReportForm(report, student)
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingComplete, setSavingComplete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localGenerateSignal, setLocalGenerateSignal] = useState(autoGenerateAiSignal);

  useEffect(() => {
    if (autoGenerateAiSignal > 0) {
      setLocalGenerateSignal(autoGenerateAiSignal);
    }
  }, [autoGenerateAiSignal]);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, report.id]);

  useEffect(() => {
    setForm(buildReportForm(report, student));
    setError(null);
  }, [report.id]);

  useEffect(() => {
    if (report.status !== ClassReportStatus.IN_PROGRESS || !report.startedAtIso) {
      setElapsedSeconds(0);
      return;
    }
    const startMs = new Date(report.startedAtIso).getTime();
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [report.status, report.startedAtIso]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const allowedSubjects = getAllowedSubjects(student);
  const studentLessonPlans = lessonPlans.filter((p) => p.studentId === report.studentId);
  const linkedPlan = form.lessonPlanId
    ? studentLessonPlans.find((p) => p.id === form.lessonPlanId)
    : undefined;

  const handleLinkPlanChange = (nextPlanId: string) => {
    const found = studentLessonPlans.find((p) => p.id === nextPlanId);
    setForm((prev) => ({
      ...prev,
      lessonPlanId: nextPlanId,
      subject:
        found && allowedSubjects.includes(found.subject)
          ? found.subject
          : prev.subject,
      topic: found && !prev.topic.trim() ? found.topic : prev.topic,
      objectivesCovered:
        found && !prev.objectivesCovered.trim()
          ? found.learningObjectives
          : prev.objectivesCovered,
      activitiesCompleted:
        found && !prev.activitiesCompleted.trim()
          ? found.activities
          : prev.activitiesCompleted,
      practicalExercisesPerformed:
        found && !prev.practicalExercisesPerformed.trim()
          ? found.practicalExercises ?? ''
          : prev.practicalExercisesPerformed,
      classworkGiven:
        found && !prev.classworkGiven.trim()
          ? found.classwork ?? ''
          : prev.classworkGiven,
      homeworkAssigned:
        found && !prev.homeworkAssigned.trim()
          ? found.homework ?? ''
          : prev.homeworkAssigned,
    }));
  };

  const handlePersist = async (targetStatus: ClassReportStatus) => {
    setError(null);
    setMessage(null);

    if (!form.topic.trim()) {
      setError('Lesson topic is required.');
      return;
    }
    if (!BLUEPRINT_LIMITS.datePattern.test(form.sessionDate.trim())) {
      setError('Please select a valid class date.');
      return;
    }
    const parsedDuration = Number(form.durationMinutes.trim());
    if (
      form.durationMinutes.trim() === '' ||
      Number.isNaN(parsedDuration) ||
      parsedDuration < 0 ||
      parsedDuration > BLUEPRINT_LIMITS.classReport.durationMax
    ) {
      setError(
        `Duration must be between 0 and ${BLUEPRINT_LIMITS.classReport.durationMax} minutes.`
      );
      return;
    }

    if (targetStatus === ClassReportStatus.DRAFT) {
      setSavingDraft(true);
    } else {
      setSavingComplete(true);
    }

    try {
      await updateClassReport(report.id, {
        subject: form.subject,
        lessonPlanId: form.lessonPlanId,
        topic: form.topic,
        sessionDate: form.sessionDate,
        durationMinutes: Math.round(parsedDuration),
        understandingLevel: form.understandingLevel,
        objectivesCovered: form.objectivesCovered,
        conceptsTaught: form.conceptsTaught,
        activitiesCompleted: form.activitiesCompleted,
        practicalExercisesPerformed: form.practicalExercisesPerformed,
        classworkGiven: form.classworkGiven,
        studentParticipation: form.studentParticipation,
        understoodWell: form.understoodWell,
        struggledWith: form.struggledWith,
        challengesEncountered: form.challengesEncountered,
        homeworkAssigned: form.homeworkAssigned,
        teacherObservations: form.teacherObservations,
        recommendationsNextFocus: form.recommendationsNextFocus,
        status: targetStatus,
      });

      if (targetStatus === ClassReportStatus.COMPLETED) {
        if (form.lessonPlanId) {
          const linked = studentLessonPlans.find((p) => p.id === form.lessonPlanId);
          if (linked && isScheduledLessonStatus(linked.status)) {
            await updateLessonPlan(linked.id, { status: LessonPlanStatus.COMPLETED });
          }
        }
        if (form.alsoAssignHomework && form.homeworkAssigned.trim()) {
          await createHomework(teacherId, {
            studentId: report.studentId,
            studentName: report.studentName,
            subject: form.subject,
            title: `${form.topic.trim()} — Homework`,
            instructions: form.homeworkAssigned.trim(),
            dueDate: form.sessionDate,
            lessonPlanId: form.lessonPlanId || undefined,
          });
        }
        onCompleted?.();
        setMode('view');
        setMessage('Completed class documentation saved.');
      } else {
        setMessage('Class documentation draft saved.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to save class documentation.'
      );
    } finally {
      setSavingDraft(false);
      setSavingComplete(false);
    }
  };

  // --- READ VIEW ---
  if (mode === 'view') {
    const readSections: Array<{
      group: string;
      fields: Array<{ label: string; value?: string }>;
    }> = [
      {
        group: 'Instruction & Lesson Coverage',
        fields: [
          { label: 'Learning Objectives Covered', value: report.objectivesCovered },
          { label: 'Concepts Taught', value: report.conceptsTaught },
          {
            label: 'Activities Completed',
            value: report.activitiesCompleted || report.notes,
          },
          {
            label: 'Practical Exercises Performed',
            value: report.practicalExercisesPerformed,
          },
          { label: 'Classwork Given', value: report.classworkGiven },
        ],
      },
      {
        group: 'Student Engagement & Understanding',
        fields: [
          {
            label: 'Student Participation & Responses',
            value: report.studentParticipation,
          },
          { label: 'Areas Understood Well', value: report.understoodWell },
          { label: 'Areas Struggled With', value: report.struggledWith },
          {
            label: 'Challenges Encountered During Class',
            value: report.challengesEncountered,
          },
        ],
      },
      {
        group: 'Follow-Up & Teacher Reflection',
        fields: [
          { label: 'Homework Assigned', value: report.homeworkAssigned },
          { label: "Teacher's Observations", value: report.teacherObservations },
          {
            label: 'Recommendations & Next Lesson Focus',
            value: report.recommendationsNextFocus || report.progressNotes,
          },
        ],
      },
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
            Back to Class Documentation
          </button>

          <div className={`${CARD_CLASS} p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {report.topic}
                </h1>
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${getClassReportStatusClass(
                    report.status
                  )}`}
                >
                  {formatClassStatusLabel(report.status)}
                </span>
                <span
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${getSubjectBadgeClass(
                    report.subject
                  )}`}
                >
                  {report.subject}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 flex flex-wrap items-center gap-x-2">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {report.studentName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{report.sessionDate}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{report.durationMinutes} min</span>
                <span aria-hidden="true">·</span>
                <span
                  className={`px-2 py-0.5 text-xs font-medium capitalize rounded-md border ${getUnderstandingBadgeClass(
                    report.understandingLevel
                  )}`}
                >
                  {report.understandingLevel}
                </span>
              </p>
              {linkedPlan && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Linked Lesson Plan: {linkedPlan.topic} ({linkedPlan.scheduledDate})
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!hasSubstantiveDocumentation(report)}
                onClick={() => {
                  setLocalGenerateSignal((n) => n + 1);
                  document
                    .getElementById('ai-report-section')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25 border border-violet-200/80 dark:border-violet-500/30 rounded-xl transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                Generate AI Report
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setMode('edit');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                Edit Documentation
              </button>
              <button
                type="button"
                onClick={() => onDeleteRequest(report)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-xl transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-6">
          {readSections.map((section) => (
            <section
              key={section.group}
              className={`${CARD_CLASS} overflow-hidden`}
            >
              <div className="px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1629]">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {section.group}
                </h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {section.fields.map((f) => (
                  <div key={f.label} className="p-6">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                      {f.label}
                    </h3>
                    {f.value?.trim() ? (
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {f.value}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-slate-500">Not recorded.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <AiReportPanel
          teacherId={teacherId}
          classReport={report}
          approvedAiReports={approvedAiReports}
          autoGenerateSignal={localGenerateSignal}
          initialApprovedReportId={initialApprovedAiReportId}
          onClearInitialApprovedReportId={onClearInitialApprovedAiReportId}
        />
      </div>
    );
  }

  const savedBaseline = buildReportForm(report, student);
  const hasUnsavedClassEdits =
    form.topic !== savedBaseline.topic ||
    form.subject !== savedBaseline.subject ||
    form.sessionDate !== savedBaseline.sessionDate ||
    form.durationMinutes !== savedBaseline.durationMinutes ||
    form.understandingLevel !== savedBaseline.understandingLevel ||
    form.objectivesCovered !== savedBaseline.objectivesCovered ||
    form.conceptsTaught !== savedBaseline.conceptsTaught ||
    form.activitiesCompleted !== savedBaseline.activitiesCompleted ||
    form.practicalExercisesPerformed !== savedBaseline.practicalExercisesPerformed ||
    form.classworkGiven !== savedBaseline.classworkGiven ||
    form.studentParticipation !== savedBaseline.studentParticipation ||
    form.understoodWell !== savedBaseline.understoodWell ||
    form.struggledWith !== savedBaseline.struggledWith ||
    form.challengesEncountered !== savedBaseline.challengesEncountered ||
    form.homeworkAssigned !== savedBaseline.homeworkAssigned ||
    form.teacherObservations !== savedBaseline.teacherObservations ||
    form.recommendationsNextFocus !== savedBaseline.recommendationsNextFocus;

  // --- EDIT / LIVE DOCUMENTATION FORM ---
  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={() => {
            if (report.status === ClassReportStatus.COMPLETED && initialMode === 'view') {
              setMode('view');
              setError(null);
            } else {
              onBack();
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          {report.status === ClassReportStatus.COMPLETED && initialMode === 'view'
            ? 'Back to Class Record'
            : 'Back to Class Documentation'}
        </button>

        <div className={`${CARD_CLASS} p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4`}>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {report.studentName} · {form.subject}
              </h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${getClassReportStatusClass(
                  report.status
                )}`}
              >
                {formatClassStatusLabel(report.status)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Document what was taught, student responses, struggles, homework, and next steps. You can save a draft at any time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {report.status === ClassReportStatus.IN_PROGRESS && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 rounded-xl text-blue-800 dark:text-blue-300">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-mono tabular-nums text-sm font-semibold">
                  {formatTimer(elapsedSeconds)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onDeleteRequest(report)}
              className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-xl transition-colors"
            >
              {report.status === ClassReportStatus.COMPLETED ? 'Delete Record' : 'Discard'}
            </button>
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

      {message && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handlePersist(ClassReportStatus.COMPLETED);
        }}
        className="space-y-6"
      >
        {/* 1. Session Details */}
        <section className={`${CARD_CLASS} p-6 space-y-4`}>
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                1. Class Details
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Save progress anytime as a draft
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="cr-subject"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Subject *
              </label>
              <select
                id="cr-subject"
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
            </div>

            <div>
              <label
                htmlFor="cr-date"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Class Date *
              </label>
              <input
                id="cr-date"
                type="date"
                required
                value={form.sessionDate}
                onChange={(e) => setForm({ ...form, sessionDate: e.target.value })}
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label
                htmlFor="cr-duration"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Duration (minutes) *
              </label>
              <input
                id="cr-duration"
                type="number"
                required
                min={0}
                max={BLUEPRINT_LIMITS.classReport.durationMax}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label
                htmlFor="cr-understanding"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Understanding Level
              </label>
              <select
                id="cr-understanding"
                value={form.understandingLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    understandingLevel: e.target.value as UnderstandingLevel,
                  })
                }
                className={INPUT_CLASS}
              >
                <option value={UnderstandingLevel.DEVELOPING}>
                  Developing — Needs more practice
                </option>
                <option value={UnderstandingLevel.STEADY}>Steady — On track</option>
                <option value={UnderstandingLevel.STRONG}>Strong — Confident grasp</option>
                <option value={UnderstandingLevel.MASTERED}>
                  Mastered — Ready for next level
                </option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cr-topic"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Lesson Topic *
              </label>
              <input
                id="cr-topic"
                type="text"
                required
                maxLength={BLUEPRINT_LIMITS.classReport.topicMax}
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="e.g., Equivalent Fractions or Loops in Python"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-plan"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Linked Lesson Plan (optional)
              </label>
              <select
                id="cr-plan"
                value={form.lessonPlanId}
                onChange={(e) => handleLinkPlanChange(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">None (ad-hoc class)</option>
                {studentLessonPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.scheduledDate} · {p.subject}: {p.topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 2. Instruction & Lesson Coverage */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              2. Instruction &amp; Lesson Coverage
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="cr-objectives"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Learning Objectives Covered
              </label>
              <textarea
                id="cr-objectives"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.objectivesCoveredMax}
                value={form.objectivesCovered}
                onChange={(e) =>
                  setForm({ ...form, objectivesCovered: e.target.value })
                }
                placeholder="Objectives addressed during this session..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-concepts"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Concepts Taught
              </label>
              <textarea
                id="cr-concepts"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.conceptsTaughtMax}
                value={form.conceptsTaught}
                onChange={(e) => setForm({ ...form, conceptsTaught: e.target.value })}
                placeholder="Key definitions, formulas, or coding concepts explained..."
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cr-activities"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Activities Completed
            </label>
            <textarea
              id="cr-activities"
              rows={3}
              maxLength={BLUEPRINT_LIMITS.classReport.activitiesCompletedMax}
              value={form.activitiesCompleted}
              onChange={(e) =>
                setForm({ ...form, activitiesCompleted: e.target.value })
              }
              placeholder="Step-by-step activities worked through in class..."
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="cr-exercises"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Practical Exercises Performed
              </label>
              <textarea
                id="cr-exercises"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.practicalExercisesPerformedMax}
                value={form.practicalExercisesPerformed}
                onChange={(e) =>
                  setForm({ ...form, practicalExercisesPerformed: e.target.value })
                }
                placeholder="Hands-on coding builds, guided examples, or practice drills..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-classwork"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Classwork Given
              </label>
              <textarea
                id="cr-classwork"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.classworkGivenMax}
                value={form.classworkGiven}
                onChange={(e) => setForm({ ...form, classworkGiven: e.target.value })}
                placeholder="Independent tasks completed during class time..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* 3. Student Engagement & Understanding */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              3. Student Response &amp; Understanding
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="cr-participation"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Student Participation &amp; Responses
              </label>
              <textarea
                id="cr-participation"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.studentParticipationMax}
                value={form.studentParticipation}
                onChange={(e) =>
                  setForm({ ...form, studentParticipation: e.target.value })
                }
                placeholder="How engaged the student was, questions asked, and answers given..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-understood"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Areas the Student Understood Well
              </label>
              <textarea
                id="cr-understood"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.understoodWellMax}
                value={form.understoodWell}
                onChange={(e) => setForm({ ...form, understoodWell: e.target.value })}
                placeholder="Strengths, quick breakthroughs, and concepts mastered..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-struggled"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Areas the Student Struggled With
              </label>
              <textarea
                id="cr-struggled"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.struggledWithMax}
                value={form.struggledWith}
                onChange={(e) => setForm({ ...form, struggledWith: e.target.value })}
                placeholder="Concepts or steps that required extra support or repetition..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-challenges"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Challenges Encountered During the Class
              </label>
              <textarea
                id="cr-challenges"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.challengesEncounteredMax}
                value={form.challengesEncountered}
                onChange={(e) =>
                  setForm({ ...form, challengesEncountered: e.target.value })
                }
                placeholder="Pacing, focus, tool/device issues, or misconceptions..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* 4. Follow-Up & Teacher Reflection */}
        <section className={`${CARD_CLASS} p-6 space-y-5`}>
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              4. Follow-Up &amp; Teacher Reflection
            </h2>
          </div>

          <div>
            <label
              htmlFor="cr-homework"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Homework Assigned
            </label>
            <textarea
              id="cr-homework"
              rows={2}
              maxLength={BLUEPRINT_LIMITS.classReport.homeworkAssignedMax}
              value={form.homeworkAssigned}
              onChange={(e) => setForm({ ...form, homeworkAssigned: e.target.value })}
              placeholder="Practice tasks assigned for after class..."
              className={INPUT_CLASS}
            />
            {form.homeworkAssigned.trim() && report.status !== ClassReportStatus.COMPLETED && (
              <label className="mt-2.5 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.alsoAssignHomework}
                  onChange={(e) =>
                    setForm({ ...form, alsoAssignHomework: e.target.checked })
                  }
                  className="accent-blue-600"
                />
                Also add this to Homework Management for {report.studentName} when marking completed
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="cr-observations"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Teacher&apos;s Observations
              </label>
              <textarea
                id="cr-observations"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.teacherObservationsMax}
                value={form.teacherObservations}
                onChange={(e) =>
                  setForm({ ...form, teacherObservations: e.target.value })
                }
                placeholder="Overall session notes, attitude, and pace..."
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="cr-recommendations"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Recommendations &amp; Next Lesson Focus
              </label>
              <textarea
                id="cr-recommendations"
                rows={3}
                maxLength={BLUEPRINT_LIMITS.classReport.recommendationsNextFocusMax}
                value={form.recommendationsNextFocus}
                onChange={(e) =>
                  setForm({ ...form, recommendationsNextFocus: e.target.value })
                }
                placeholder="Recommended topics, review items, or exercises for the next class..."
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={savingDraft || savingComplete}
            onClick={() => {
              if (report.status === ClassReportStatus.COMPLETED && initialMode === 'view') {
                setMode('view');
                setError(null);
              } else {
                onBack();
              }
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Back
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={savingDraft || savingComplete}
              onClick={() => void handlePersist(ClassReportStatus.DRAFT)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-100 dark:hover:bg-amber-500/25 rounded-xl transition-colors disabled:opacity-60"
            >
              {report.status === ClassReportStatus.COMPLETED ? (
                <FileText className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savingDraft ? 'Saving Draft...' : 'Save as Draft'}
            </button>

            <button
              type="submit"
              disabled={savingDraft || savingComplete}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {savingComplete
                ? 'Saving...'
                : report.status === ClassReportStatus.COMPLETED
                ? 'Save Changes'
                : 'Mark Documentation Completed'}
            </button>
          </div>
        </div>
      </form>

      <AiReportPanel
        teacherId={teacherId}
        classReport={report}
        approvedAiReports={approvedAiReports}
        autoGenerateSignal={localGenerateSignal}
        initialApprovedReportId={initialApprovedAiReportId}
        onClearInitialApprovedReportId={onClearInitialApprovedAiReportId}
        hasUnsavedClassEdits={hasUnsavedClassEdits}
      />
    </div>
  );
}
