import { useEffect, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  Clock,
  Edit3,
  Eye,
  FileText,
  Play,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  ClassReportStatus,
  formatClassStatusLabel,
  formatLessonStatusLabel,
  isScheduledLessonStatus,
  LessonPlanStatus,
  StudentStatus,
  Subject,
  type ApprovedAiReport,
  type ClassReport,
  type LessonPlan,
  type Student,
} from '../types/teaching';
import { hasSubstantiveDocumentation } from '../lib/aiReportService';
import {
  deleteClassReport,
  startClassSession,
  todayIsoDate,
} from '../lib/firestoreService';
import {
  CARD_CLASS,
  FILTER_INPUT_CLASS,
  getClassReportStatusClass,
  getSubjectBadgeClass,
  getUnderstandingBadgeClass,
  INPUT_CLASS,
} from '../lib/uiTokens';
import {
  ClassReportEditorView,
  type ReportEditorMode,
} from './ClassReportEditorView';
import { ConfirmDialog } from './ConfirmDialog';

export interface StartClassPrefill {
  studentId: string;
  subject: Subject;
  topic?: string;
  lessonPlanId?: string;
}

interface ClassDocumentationViewProps {
  teacherId: string;
  students: Student[];
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  aiReports: ApprovedAiReport[];
  loading: boolean;
  prefill?: StartClassPrefill | null;
  onClearPrefill?: () => void;
  initialReportId?: string | null;
  onClearInitialReportId?: () => void;
  initialAiReportId?: string | null;
  onClearInitialAiReportId?: () => void;
}

function getStudentAllowedSubjects(student: Student | undefined): Subject[] {
  if (!student || student.subjects.length === 0) {
    return [Subject.MATHEMATICS, Subject.TECHNOLOGY];
  }
  return student.subjects;
}

export function ClassDocumentationView({
  teacherId,
  students,
  lessonPlans,
  classReports,
  aiReports,
  loading,
  prefill,
  onClearPrefill,
  initialReportId,
  onClearInitialReportId,
  initialAiReportId,
  onClearInitialAiReportId,
}: ClassDocumentationViewProps) {
  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);

  const ongoingReports = classReports
    .filter((r) => r.status !== ClassReportStatus.COMPLETED)
    .sort((a, b) => {
      const dateCmp = b.sessionDate.localeCompare(a.sessionDate);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
    });

  const completedReports = classReports
    .filter((r) => r.status === ClassReportStatus.COMPLETED)
    .sort((a, b) => {
      const dateCmp = b.sessionDate.localeCompare(a.sessionDate);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
    });

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activeEditorMode, setActiveEditorMode] = useState<ReportEditorMode>('edit');
  const [aiGenerateTrigger, setAiGenerateTrigger] = useState(0);
  const [pendingAiReportId, setPendingAiReportId] = useState<string | null>(null);

  const [startStudentId, setStartStudentId] = useState('');
  const [startSubject, setStartSubject] = useState<Subject>(Subject.TECHNOLOGY);
  const [startPlanId, setStartPlanId] = useState('');
  const [startTopic, setStartTopic] = useState('');
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [startDuration, setStartDuration] = useState('45');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStudentId, setFilterStudentId] = useState('all');
  const [filterSubject, setFilterSubject] = useState<'all' | Subject>('all');

  const [deleteTarget, setDeleteTarget] = useState<ClassReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!startStudentId && activeStudents.length > 0) {
      const first = activeStudents[0];
      setStartStudentId(first.id);
      setStartSubject(first.subjects[0] ?? Subject.TECHNOLOGY);
    }
  }, [activeStudents, startStudentId]);

  useEffect(() => {
    if (!prefill) return;
    const student = students.find((s) => s.id === prefill.studentId);
    const allowed = getStudentAllowedSubjects(student);
    const resolvedSubject = allowed.includes(prefill.subject)
      ? prefill.subject
      : allowed[0];

    setStartStudentId(prefill.studentId);
    setStartSubject(resolvedSubject);
    setStartPlanId(prefill.lessonPlanId ?? '');
    setStartTopic(prefill.topic ?? '');
    setStartDate(todayIsoDate());

    if (prefill.lessonPlanId) {
      const linked = lessonPlans.find((p) => p.id === prefill.lessonPlanId);
      if (linked?.durationMinutes) {
        setStartDuration(String(linked.durationMinutes));
      }
    }

    setActiveReportId(null);
    setStartError(null);
    onClearPrefill?.();
  }, [prefill, students, lessonPlans, onClearPrefill]);

  useEffect(() => {
    if (!initialReportId) return;
    const target = classReports.find((r) => r.id === initialReportId);
    if (target) {
      setActiveReportId(target.id);
      setActiveEditorMode(
        target.status === ClassReportStatus.COMPLETED ? 'view' : 'edit'
      );
      setAiGenerateTrigger(0);
      onClearInitialReportId?.();
    }
  }, [initialReportId, classReports, onClearInitialReportId]);

  useEffect(() => {
    if (!initialAiReportId) return;
    const targetAi = aiReports.find((a) => a.id === initialAiReportId);
    if (targetAi) {
      const parentClass = classReports.find((c) => c.id === targetAi.classReportId);
      if (parentClass) {
        setActiveReportId(parentClass.id);
        setActiveEditorMode(
          parentClass.status === ClassReportStatus.COMPLETED ? 'view' : 'edit'
        );
        setAiGenerateTrigger(0);
        setPendingAiReportId(targetAi.id);
      }
      onClearInitialAiReportId?.();
    }
  }, [initialAiReportId, aiReports, classReports, onClearInitialAiReportId]);

  const selectedStudent = students.find((s) => s.id === startStudentId);
  const allowedStartSubjects = getStudentAllowedSubjects(selectedStudent);

  const plansForSelectedStudent = lessonPlans
    .filter(
      (p) =>
        p.studentId === startStudentId && p.status !== LessonPlanStatus.CANCELLED
    )
    .sort((a, b) => {
      const aSched = isScheduledLessonStatus(a.status) ? 0 : 1;
      const bSched = isScheduledLessonStatus(b.status) ? 0 : 1;
      if (aSched !== bSched) return aSched - bSched;
      return b.scheduledDate.localeCompare(a.scheduledDate);
    });

  const handleSelectStartStudent = (studentId: string) => {
    setStartStudentId(studentId);
    setStartPlanId('');
    const found = students.find((s) => s.id === studentId);
    const allowed = getStudentAllowedSubjects(found);
    if (!allowed.includes(startSubject)) {
      setStartSubject(allowed[0]);
    }
  };

  const handleSelectPlan = (planId: string) => {
    setStartPlanId(planId);
    const found = lessonPlans.find((p) => p.id === planId);
    if (found) {
      if (allowedStartSubjects.includes(found.subject)) {
        setStartSubject(found.subject);
      }
      setStartTopic(found.topic);
      if (found.durationMinutes !== undefined) {
        setStartDuration(String(found.durationMinutes));
      }
    }
  };

  const handleStartClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartError(null);

    const student = students.find((s) => s.id === startStudentId);
    if (!student) {
      setStartError('Please select a student.');
      return;
    }

    const allowed = getStudentAllowedSubjects(student);
    const resolvedSubject = allowed.includes(startSubject)
      ? startSubject
      : allowed[0];

    if (!startTopic.trim()) {
      setStartError('Please enter a lesson topic.');
      return;
    }

    if (!BLUEPRINT_LIMITS.datePattern.test(startDate.trim())) {
      setStartError('Please enter a valid class date.');
      return;
    }

    const parsedDuration = Number(startDuration.trim());
    if (
      startDuration.trim() === '' ||
      Number.isNaN(parsedDuration) ||
      parsedDuration < 0 ||
      parsedDuration > BLUEPRINT_LIMITS.classReport.durationMax
    ) {
      setStartError(
        `Duration must be between 0 and ${BLUEPRINT_LIMITS.classReport.durationMax} minutes.`
      );
      return;
    }

    const linkedPlan = startPlanId
      ? lessonPlans.find((p) => p.id === startPlanId)
      : undefined;

    setStarting(true);
    try {
      const newReportId = await startClassSession(teacherId, {
        studentId: student.id,
        studentName: student.fullName,
        subject: resolvedSubject,
        topic: startTopic,
        lessonPlanId: linkedPlan?.id,
        sessionDate: startDate,
        durationMinutes: Math.round(parsedDuration),
        objectivesCovered: linkedPlan?.learningObjectives ?? '',
        activitiesCompleted: linkedPlan?.activities ?? '',
        practicalExercisesPerformed: linkedPlan?.practicalExercises ?? '',
        classworkGiven: linkedPlan?.classwork ?? '',
        homeworkAssigned: linkedPlan?.homework ?? '',
        status: ClassReportStatus.IN_PROGRESS,
      });

      setStartTopic('');
      setStartPlanId('');
      setActiveEditorMode('edit');
      setActiveReportId(newReportId);
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : 'Unable to start class documentation.'
      );
    } finally {
      setStarting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      const deletingActive = deleteTarget.id === activeReportId;
      await deleteClassReport(deleteTarget.id);
      if (deletingActive) {
        setActiveReportId(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete class record.'
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openReport = (report: ClassReport, mode: ReportEditorMode) => {
    setActionError(null);
    setAiGenerateTrigger(0);
    setPendingAiReportId(null);
    setActiveEditorMode(mode);
    setActiveReportId(report.id);
  };

  const handleGenerateAiForRecord = (report: ClassReport) => {
    if (!hasSubstantiveDocumentation(report)) {
      setActionError(
        `Cannot generate an AI report for "${report.topic}" because no teaching notes, objectives, activities, or observations have been saved yet.`
      );
      return;
    }
    setActionError(null);
    setPendingAiReportId(null);
    setActiveEditorMode(
      report.status === ClassReportStatus.COMPLETED ? 'view' : 'edit'
    );
    setActiveReportId(report.id);
    setAiGenerateTrigger((n) => n + 1);
  };

  const activeReport = activeReportId
    ? classReports.find((r) => r.id === activeReportId) ?? null
    : null;

  if (activeReport) {
    const reportStudent = students.find((s) => s.id === activeReport.studentId);
    const matchingAiReports = aiReports.filter(
      (a) => a.classReportId === activeReport.id
    );
    return (
      <>
        <ClassReportEditorView
          teacherId={teacherId}
          report={activeReport}
          student={reportStudent}
          lessonPlans={lessonPlans}
          approvedAiReports={matchingAiReports}
          initialMode={activeEditorMode}
          autoGenerateAiSignal={aiGenerateTrigger}
          initialApprovedAiReportId={pendingAiReportId}
          onClearInitialApprovedAiReportId={() => setPendingAiReportId(null)}
          onBack={() => {
            setActiveReportId(null);
            setAiGenerateTrigger(0);
            setPendingAiReportId(null);
          }}
          onDeleteRequest={(target) => setDeleteTarget(target)}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title={
            deleteTarget?.status === ClassReportStatus.COMPLETED
              ? 'Delete class record?'
              : 'Discard class documentation?'
          }
          description={`Remove "${deleteTarget?.topic ?? ''}" for ${deleteTarget?.studentName ?? ''}? This cannot be undone.`}
          confirmLabel={
            deleteTarget?.status === ClassReportStatus.COMPLETED
              ? 'Delete Record'
              : 'Discard Documentation'
          }
          busy={deleting}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      </>
    );
  }

  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredCompleted = completedReports.filter((r) => {
    if (filterStudentId !== 'all' && r.studentId !== filterStudentId) return false;
    if (filterSubject !== 'all' && r.subject !== filterSubject) return false;
    if (normalizedQuery) {
      const haystack = [
        r.topic,
        r.studentName,
        r.conceptsTaught,
        r.objectivesCovered,
        r.activitiesCompleted,
        r.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/20">
          <ClipboardCheck className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Class Documentation
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Start a class, document concepts taught and student progress, save drafts anytime, and generate AI class reports.
          </p>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      {/* 1. Start a Class */}
      <section className={`${CARD_CLASS} p-6`}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Play className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Start a Class
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a student, choose one of their assigned subjects, optionally link a lesson plan, and start documenting.
            </p>
          </div>
        </div>

        {startError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
          >
            {startError}
          </div>
        )}

        {activeStudents.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Add an active student before starting class documentation.
          </p>
        ) : (
          <form onSubmit={handleStartClass} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="start-student"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Student *
                </label>
                <select
                  id="start-student"
                  required
                  value={startStudentId}
                  onChange={(e) => handleSelectStartStudent(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {activeStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="start-subject"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Subject *
                </label>
                <select
                  id="start-subject"
                  required
                  value={startSubject}
                  onChange={(e) => setStartSubject(e.target.value as Subject)}
                  className={INPUT_CLASS}
                >
                  {allowedStartSubjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Class Date *
                </label>
                <input
                  id="start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>

              <div>
                <label
                  htmlFor="start-duration"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Duration (minutes) *
                </label>
                <input
                  id="start-duration"
                  type="number"
                  required
                  min={0}
                  max={BLUEPRINT_LIMITS.classReport.durationMax}
                  value={startDuration}
                  onChange={(e) => setStartDuration(e.target.value)}
                  className={`${INPUT_CLASS} font-mono tabular-nums`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="start-plan"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Existing Lesson Plan (optional)
                </label>
                <select
                  id="start-plan"
                  value={startPlanId}
                  onChange={(e) => handleSelectPlan(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">None (enter new lesson topic)</option>
                  {plansForSelectedStudent.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.scheduledDate} · {p.subject}: {p.topic} (
                      {formatLessonStatusLabel(p.status)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="start-topic"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Lesson Topic *
                </label>
                <input
                  id="start-topic"
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.classReport.topicMax}
                  value={startTopic}
                  onChange={(e) => setStartTopic(e.target.value)}
                  placeholder="e.g., Equivalent Fractions or Building a Calculator in Scratch"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={starting}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-60"
              >
                <Play className="w-4 h-4" />
                {starting ? 'Starting Documentation...' : 'Start Documentation'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 2. Ongoing Classes & Saved Drafts */}
      {ongoingReports.length > 0 && (
        <section className="bg-white dark:bg-[#131D33] border border-blue-200 dark:border-blue-500/30 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-500/15 dark:to-indigo-500/10 border-b border-blue-100 dark:border-blue-500/20 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Active Sessions &amp; Saved Drafts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Continue documenting unfinished classes or mark them completed.
              </p>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-blue-600 text-white tabular-nums">
              {ongoingReports.length} open
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ongoingReports.map((rep) => (
              <div
                key={rep.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getClassReportStatusClass(
                        rep.status
                      )}`}
                    >
                      {rep.status === ClassReportStatus.IN_PROGRESS ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <FileText className="w-3 h-3" />
                      )}
                      {formatClassStatusLabel(rep.status)}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {rep.topic}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                        rep.subject
                      )}`}
                    >
                      {rep.subject}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-2">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {rep.studentName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{rep.sessionDate}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{rep.durationMinutes} min</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleGenerateAiForRecord(rep)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate AI Report
                  </button>
                  <button
                    type="button"
                    onClick={() => openReport(rep, 'edit')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Continue Documentation
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(rep)}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                    aria-label={`Delete draft ${rep.topic}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Completed Class Records */}
      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Completed Class Records
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {filteredCompleted.length} of {completedReports.length}{' '}
              {completedReports.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by topic, student, or concepts taught..."
                aria-label="Search class records"
                className={`${FILTER_INPUT_CLASS} pl-9 py-1.5 text-xs`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
                aria-label="Filter records by student"
                className={`${FILTER_INPUT_CLASS} w-auto py-1.5 text-xs`}
              >
                <option value="all">All Students</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800">
                {(['all', Subject.MATHEMATICS, Subject.TECHNOLOGY] as const).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setFilterSubject(sub)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      filterSubject === sub
                        ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {sub === 'all' ? 'All Subjects' : sub}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          </div>
        ) : filteredCompleted.length === 0 ? (
          <div className="p-8 text-center">
            <BookOpen className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {completedReports.length === 0
                ? 'No completed class records documented yet.'
                : 'No completed class records match your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCompleted.map((report) => {
              const previewText =
                report.conceptsTaught ||
                report.understoodWell ||
                report.activitiesCompleted ||
                report.notes ||
                '';
              return (
                <div
                  key={report.id}
                  className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openReport(report, 'view')}
                        className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {report.topic}
                      </button>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                          report.subject
                        )}`}
                      >
                        {report.subject}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium capitalize rounded-md border ${getUnderstandingBadgeClass(
                          report.understandingLevel
                        )}`}
                      >
                        {report.understandingLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {report.studentName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{report.sessionDate}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {report.durationMinutes} min
                      </span>
                    </p>
                    {previewText && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 line-clamp-2">
                        {previewText}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleGenerateAiForRecord(report)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate AI Report
                    </button>
                    {aiReports.some((a) => a.classReportId === report.id) && (
                      <button
                        type="button"
                        onClick={() => {
                          const latestAi = aiReports.find(
                            (a) => a.classReportId === report.id
                          );
                          if (latestAi) {
                            setPendingAiReportId(latestAi.id);
                          }
                          openReport(report, 'view');
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Approved Report
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openReport(report, 'view')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Open Record
                    </button>
                    <button
                      type="button"
                      onClick={() => openReport(report, 'edit')}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                      aria-label={`Edit record ${report.topic}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(report)}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                      aria-label={`Delete record ${report.topic}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.status === ClassReportStatus.COMPLETED
            ? 'Delete class record?'
            : 'Discard class documentation?'
        }
        description={`Remove "${deleteTarget?.topic ?? ''}" for ${deleteTarget?.studentName ?? ''}? This cannot be undone.`}
        confirmLabel={
          deleteTarget?.status === ClassReportStatus.COMPLETED
            ? 'Delete Record'
            : 'Discard Documentation'
        }
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
