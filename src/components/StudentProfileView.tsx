import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileBarChart2,
  FileCheck,
  FolderOpen,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  ClassReportStatus,
  formatHomeworkStatusLabel,
  formatLessonStatusLabel,
  getEffectiveHomeworkStatus,
  HomeworkStatus,
  isScheduledLessonStatus,
  MonthlyReportStatus,
  ResourceType,
  StudentStatus,
  Subject,
  UnderstandingLevel,
  type ApprovedAiReport,
  type ClassReport,
  type Homework,
  type LessonPlan,
  type MonthlyReport,
  type Student,
  type StudentResource,
} from '../types/teaching';
import {
  createResource,
  deleteHomework,
  deleteMonthlyReport,
  deleteResource,
  todayIsoDate,
  updateHomework,
  updateStudent,
} from '../lib/firestoreService';
import { downloadMonthlyReportPdf } from '../lib/monthlyReportPdf';
import {
  CARD_CLASS,
  getHomeworkStatusClass,
  getLessonStatusClass,
  getMonthlyReportStatusClass,
  getStudentAvatarGradient,
  getStudentInitials,
  getSubjectBadgeClass,
  getUnderstandingBadgeClass,
  INPUT_CLASS,
} from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';
import { HomeworkDetailModal } from './HomeworkDetailModal';
import { HomeworkFormModal } from './HomeworkFormModal';
import { HomeworkLinkBadges } from './HomeworkLinkListEditor';
import { StudentFormModal } from './StudentFormModal';
import { formatStudentAgeGrade } from './StudentsView';

type ProfileTab =
  | 'overview'
  | 'history'
  | 'progress'
  | 'homework'
  | 'monthly-reports'
  | 'resources';

interface StudentProfileViewProps {
  teacherId: string;
  student: Student;
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  aiReports: ApprovedAiReport[];
  homework: Homework[];
  resources: StudentResource[];
  monthlyReports: MonthlyReport[];
  onBack: () => void;
  onStartClass: (student: Student) => void;
  onPlanLesson: (student: Student) => void;
  onOpenLessonPlan?: (plan: LessonPlan) => void;
  onOpenClassReport?: (report: ClassReport) => void;
  onOpenAiReport?: (aiReport: ApprovedAiReport) => void;
  onOpenMonthlyReport?: (report: MonthlyReport) => void;
  onGenerateMonthlyReport?: (student: Student) => void;
}

export function StudentProfileView({
  teacherId,
  student,
  lessonPlans,
  classReports,
  aiReports,
  homework,
  resources,
  monthlyReports,
  onBack,
  onStartClass,
  onPlanLesson,
  onOpenLessonPlan,
  onOpenClassReport,
  onOpenAiReport,
  onOpenMonthlyReport,
  onGenerateMonthlyReport,
}: StudentProfileViewProps) {
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<ClassReport | null>(null);
  const [viewingAiReport, setViewingAiReport] = useState<ApprovedAiReport | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Learning Progress state
  const [progressSummary, setProgressSummary] = useState(student.progressSummary ?? '');
  const [mathLevel, setMathLevel] = useState(student.mathLevel ?? '');
  const [techLevel, setTechLevel] = useState(student.techLevel ?? '');
  const [learningGoals, setLearningGoals] = useState(student.learningGoals ?? '');
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);

  // Homework modals & delete state
  const [hwModalOpen, setHwModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [detailHomeworkId, setDetailHomeworkId] = useState<string | null>(null);
  const [deleteHwTarget, setDeleteHwTarget] = useState<Homework | null>(null);
  const [deletingHw, setDeletingHw] = useState(false);

  // Resource modal
  const [resModalOpen, setResModalOpen] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resSubject, setResSubject] = useState<Subject>(student.subjects[0] ?? Subject.TECHNOLOGY);
  const [resType, setResType] = useState<ResourceType>(ResourceType.WORKSHEET);
  const [resUrl, setResUrl] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [resError, setResError] = useState<string | null>(null);
  const [savingRes, setSavingRes] = useState(false);
  const [deleteResTarget, setDeleteResTarget] = useState<StudentResource | null>(null);
  const [deletingRes, setDeletingRes] = useState(false);
  const [deleteMrTarget, setDeleteMrTarget] = useState<MonthlyReport | null>(null);
  const [deletingMr, setDeletingMr] = useState(false);

  useEffect(() => {
    setProgressSummary(student.progressSummary ?? '');
    setMathLevel(student.mathLevel ?? '');
    setTechLevel(student.techLevel ?? '');
    setLearningGoals(student.learningGoals ?? '');
    setResSubject(student.subjects[0] ?? Subject.TECHNOLOGY);
    setViewingReport(null);
    setViewingAiReport(null);
    setDetailHomeworkId(null);
    setEditingHomework(null);
    setDeleteMrTarget(null);
  }, [student]);

  const allowedSubjects =
    student.subjects.length > 0
      ? student.subjects
      : [Subject.MATHEMATICS, Subject.TECHNOLOGY];
  const studentPlans = lessonPlans.filter((p) => p.studentId === student.id);
  const studentReports = classReports.filter((r) => r.studentId === student.id);
  const completedReports = studentReports
    .filter((r) => r.status === ClassReportStatus.COMPLETED)
    .sort((a, b) => {
      const dateCmp = b.sessionDate.localeCompare(a.sessionDate);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
    });
  const studentAiReports = aiReports
    .filter((a) => a.studentId === student.id)
    .sort((a, b) => {
      const dateCmp = b.sessionDate.localeCompare(a.sessionDate);
      if (dateCmp !== 0) return dateCmp;
      return (b.approvedAt?.toMillis?.() ?? 0) - (a.approvedAt?.toMillis?.() ?? 0);
    });
  const today = todayIsoDate();
  const studentHomework = homework.filter((h) => h.studentId === student.id);
  const studentResources = resources.filter((r) => r.studentId === student.id);
  const studentMonthlyReports = monthlyReports
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => {
      const monthCmp = b.monthKey.localeCompare(a.monthKey);
      if (monthCmp !== 0) return monthCmp;
      return (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
    });
  const approvedMonthlyCount = studentMonthlyReports.filter(
    (r) => r.status === MonthlyReportStatus.APPROVED
  ).length;

  const upcomingStudentPlansCount = studentPlans.filter((p) =>
    isScheduledLessonStatus(p.status)
  ).length;
  const completedStudentHwCount = studentHomework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'completed'
  ).length;
  const overdueStudentHwCount = studentHomework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'overdue'
  ).length;
  const pendingStudentHwCount = studentHomework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) !== 'completed'
  ).length;
  const hwCompletionRate =
    studentHomework.length > 0
      ? Math.round((completedStudentHwCount / studentHomework.length) * 100)
      : 0;
  const recentHomeworkFeedback = studentHomework
    .filter(
      (h) =>
        Boolean(h.feedback?.trim()) ||
        Boolean(h.score?.trim()) ||
        Boolean(h.areasForImprovement?.trim())
    )
    .sort(
      (a, b) =>
        (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
    )
    .slice(0, 4);
  const detailHomework = detailHomeworkId
    ? studentHomework.find((h) => h.id === detailHomeworkId) ?? null
    : null;

  const understandingBreakdown = [
    {
      level: UnderstandingLevel.MASTERED,
      label: 'Mastered',
      count: completedReports.filter((r) => r.understandingLevel === UnderstandingLevel.MASTERED).length,
      barClass: 'bg-teal-500',
    },
    {
      level: UnderstandingLevel.STRONG,
      label: 'Strong',
      count: completedReports.filter((r) => r.understandingLevel === UnderstandingLevel.STRONG).length,
      barClass: 'bg-blue-500',
    },
    {
      level: UnderstandingLevel.STEADY,
      label: 'Steady',
      count: completedReports.filter((r) => r.understandingLevel === UnderstandingLevel.STEADY).length,
      barClass: 'bg-violet-500',
    },
    {
      level: UnderstandingLevel.DEVELOPING,
      label: 'Developing',
      count: completedReports.filter((r) => r.understandingLevel === UnderstandingLevel.DEVELOPING).length,
      barClass: 'bg-orange-500',
    },
  ];

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProgress(true);
    setProgressError(null);
    setProgressMessage(null);
    try {
      await updateStudent(student.id, {
        progressSummary,
        mathLevel,
        techLevel,
        learningGoals,
      });
      setProgressMessage('Learning progress saved.');
    } catch (err) {
      setProgressError(err instanceof Error ? err.message : 'Unable to save learning progress.');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setResError(null);
    if (!resTitle.trim()) {
      setResError('Resource title is required.');
      return;
    }
    setSavingRes(true);
    try {
      await createResource(teacherId, {
        studentId: student.id,
        subject: resSubject,
        title: resTitle,
        resourceType: resType,
        url: resUrl,
        notes: resNotes,
      });
      setResModalOpen(false);
      setResTitle('');
      setResUrl('');
      setResNotes('');
    } catch (err) {
      setResError(err instanceof Error ? err.message : 'Unable to save resource.');
    } finally {
      setSavingRes(false);
    }
  };

  const handleToggleArchive = async () => {
    setActionError(null);
    try {
      await updateStudent(student.id, {
        status:
          student.status === StudentStatus.ACTIVE
            ? StudentStatus.ARCHIVED
            : StudentStatus.ACTIVE,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update student status.');
    }
  };

  const handleHomeworkStatus = async (item: Homework, status: HomeworkStatus) => {
    setActionError(null);
    try {
      const payload: { status: HomeworkStatus; submittedDate?: string } = { status };
      if (
        (status === HomeworkStatus.SUBMITTED ||
          status === HomeworkStatus.UNDER_REVIEW ||
          status === HomeworkStatus.COMPLETED) &&
        !item.submittedDate
      ) {
        payload.submittedDate = todayIsoDate();
      }
      await updateHomework(item.id, payload);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update homework status.');
    }
  };

  const handleConfirmDeleteHw = async () => {
    if (!deleteHwTarget) return;
    setDeletingHw(true);
    setActionError(null);
    try {
      const deletedId = deleteHwTarget.id;
      await deleteHomework(deletedId);
      setDeleteHwTarget(null);
      if (detailHomeworkId === deletedId) {
        setDetailHomeworkId(null);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete homework.');
      setDeleteHwTarget(null);
    } finally {
      setDeletingHw(false);
    }
  };

  const handleConfirmDeleteRes = async () => {
    if (!deleteResTarget) return;
    setDeletingRes(true);
    setActionError(null);
    try {
      await deleteResource(deleteResTarget.id);
      setDeleteResTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete resource.');
      setDeleteResTarget(null);
    } finally {
      setDeletingRes(false);
    }
  };

  const handleConfirmDeleteMonthlyReport = async () => {
    if (!deleteMrTarget) return;
    setDeletingMr(true);
    setActionError(null);
    try {
      await deleteMonthlyReport(deleteMrTarget.id);
      setDeleteMrTarget(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete monthly report.'
      );
      setDeleteMrTarget(null);
    } finally {
      setDeletingMr(false);
    }
  };

  const ageGradeDisplay = formatStudentAgeGrade(student);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Hero Card */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </button>

        <div className={`${CARD_CLASS} overflow-hidden`}>
          <div className="h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500" />
          <div className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getStudentAvatarGradient(
                  student.fullName
                )} text-white text-lg font-bold flex items-center justify-center shrink-0 shadow-md`}
              >
                {getStudentInitials(student.fullName)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {student.fullName}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${
                      student.status === StudentStatus.ACTIVE
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                    }`}
                  >
                    {student.status === StudentStatus.ACTIVE ? 'Active Student' : 'Archived'}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  {student.subjects.map((subj) => (
                    <span
                      key={subj}
                      className={`px-2 py-0.5 text-xs font-medium rounded-md border ${getSubjectBadgeClass(
                        subj
                      )}`}
                    >
                      {subj}
                    </span>
                  ))}
                  {ageGradeDisplay !== '—' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-700 dark:text-slate-300">{ageGradeDisplay}</span>
                    </>
                  )}
                  {student.school && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{student.school}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => void handleToggleArchive()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
              >
                {student.status === StudentStatus.ACTIVE ? (
                  <>
                    <Archive className="w-4 h-4" />
                    Archive
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="w-4 h-4" />
                    Restore
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => onPlanLesson(student)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/30 hover:bg-violet-100 dark:hover:bg-violet-500/25 rounded-xl transition-colors whitespace-nowrap"
              >
                <CalendarClock className="w-4 h-4" />
                Plan Lesson
              </button>
              <button
                type="button"
                onClick={() => onStartClass(student)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all whitespace-nowrap"
              >
                <ClipboardCheck className="w-4 h-4" />
                Start Class
              </button>
            </div>
          </div>
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

      {/* Profile Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-x-auto shadow-xs">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'history', label: 'Lesson History' },
            { id: 'progress', label: 'Learning Progress' },
            { id: 'homework', label: 'Homework' },
            {
              id: 'monthly-reports',
              label:
                studentMonthlyReports.length > 0
                  ? `Monthly Reports (${studentMonthlyReports.length})`
                  : 'Monthly Reports',
            },
            { id: 'resources', label: 'Learning Resources' },
          ] as Array<{ id: ProfileTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-8 ${CARD_CLASS} p-6 space-y-5`}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Student Information
              </h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Edit details
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Full Name
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {student.fullName}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Subjects
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {student.subjects.map((subj) => (
                    <span
                      key={subj}
                      className={`px-2 py-0.5 text-xs font-medium rounded-md border ${getSubjectBadgeClass(
                        subj
                      )}`}
                    >
                      {subj}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Age</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
                  {student.age?.trim() || '—'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Grade</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {student.grade?.trim() || '—'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">School</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {student.school?.trim() || '—'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Parent / Guardian Name(s)
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {student.guardianName?.trim() || '—'}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
                Additional Teaching Notes
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {student.teachingNotes?.trim() || 'No teaching notes added yet.'}
              </p>
            </div>

            {(student.learningGoals?.trim() || student.progressSummary?.trim()) && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                {student.learningGoals?.trim() && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      Learning Goals
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {student.learningGoals}
                    </p>
                  </div>
                )}
                {student.progressSummary?.trim() && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      Current Progress Summary
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {student.progressSummary}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`lg:col-span-4 ${CARD_CLASS} p-6 space-y-5`}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Activity &amp; Progress
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-500/10 border border-teal-200/70 dark:border-teal-500/20">
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300">
                  Completed
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {completedReports.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Classes</p>
              </div>

              <div className="p-3.5 rounded-xl bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/20">
                <p className="text-xs font-medium text-violet-700 dark:text-violet-300">
                  Upcoming
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {upcomingStudentPlansCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Lesson plans</p>
              </div>

              <div className="p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/10 border border-orange-200/70 dark:border-orange-500/20">
                <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                  Pending
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {pendingStudentHwCount}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {overdueStudentHwCount > 0 ? `${overdueStudentHwCount} overdue` : 'Homework'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/20">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Resources
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                  {studentResources.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Attached</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  Homework Completed
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {completedStudentHwCount} / {studentHomework.length} ({hwCompletionRate}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500 transition-all"
                  style={{ width: `${hwCompletionRate}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileBarChart2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Monthly Progress Reports
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {studentMonthlyReports.length === 0
                    ? 'None generated yet'
                    : `${approvedMonthlyCount} approved · ${studentMonthlyReports.length} total`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab('monthly-reports')}
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {studentMonthlyReports.length === 0 ? 'Create' : 'View'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-6">
          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Completed Class Reports
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {completedReports.length} completed{' '}
                {completedReports.length === 1 ? 'lesson' : 'lessons'}
              </span>
            </div>

            {completedReports.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                  No completed classes documented for {student.fullName} yet.
                </p>
                <button
                  type="button"
                  onClick={() => onStartClass(student)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  Start First Class
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {completedReports.map((rep) => {
                  const preview =
                    rep.conceptsTaught ||
                    rep.understoodWell ||
                    rep.activitiesCompleted ||
                    rep.notes ||
                    '';
                  const nextStep = rep.recommendationsNextFocus || rep.progressNotes;
                  return (
                    <div
                      key={rep.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingReport(rep)}
                            className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {rep.topic}
                          </button>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                              rep.subject
                            )}`}
                          >
                            {rep.subject}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium capitalize rounded-md border ${getUnderstandingBadgeClass(
                              rep.understandingLevel
                            )}`}
                          >
                            {rep.understandingLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {rep.sessionDate} · {rep.durationMinutes} min
                        </p>
                        {preview && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 pt-0.5">
                            {preview}
                          </p>
                        )}
                        {nextStep && (
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 line-clamp-1 pt-0.5">
                            Next focus: {nextStep}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                        {studentAiReports
                          .filter((a) => a.classReportId === rep.id)
                          .slice(0, 1)
                          .map((aiRep) => (
                            <button
                              key={aiRep.id}
                              type="button"
                              onClick={() => setViewingAiReport(aiRep)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200/70 dark:border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Approved AI Report
                            </button>
                          ))}
                        <button
                          type="button"
                          onClick={() => setViewingReport(rep)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Open Record
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Approved AI Class Reports
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {studentAiReports.length} saved
              </span>
            </div>

            {studentAiReports.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No approved AI reports saved for {student.fullName} yet. Generate and approve reports from Class Documentation.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentAiReports.map((aiRep) => (
                  <div
                    key={aiRep.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <button
                        type="button"
                        onClick={() => setViewingAiReport(aiRep)}
                        className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {aiRep.lessonTopic}
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {aiRep.subject} · {aiRep.dateAndDuration}
                      </p>
                      {aiRep.demonstratedUnderstanding && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 pt-0.5">
                          {aiRep.demonstratedUnderstanding}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={() => setViewingAiReport(aiRep)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/15 hover:bg-violet-100 dark:hover:bg-violet-500/25 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View AI Report
                      </button>
                      {onOpenAiReport && (
                        <button
                          type="button"
                          onClick={() => onOpenAiReport(aiRep)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Lesson Plans for {student.fullName}
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {studentPlans.length} total
              </span>
            </div>
            {studentPlans.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                No lesson plans created for {student.fullName} yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-5 space-y-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {plan.topic}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getLessonStatusClass(
                            plan.status
                          )}`}
                        >
                          {formatLessonStatusLabel(plan.status)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                        {plan.subject} · {plan.scheduledDate}
                        {plan.durationMinutes ? ` · ${plan.durationMinutes} min` : ''}
                      </p>
                      {plan.learningObjectives && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 pt-1 line-clamp-2">
                          {plan.learningObjectives}
                        </p>
                      )}
                    </div>
                    {onOpenLessonPlan && (
                      <button
                        type="button"
                        onClick={() => onOpenLessonPlan(plan)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start"
                      >
                        Open Plan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'progress' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveProgress}
            className={`lg:col-span-7 ${CARD_CLASS} p-6 space-y-4`}
          >
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Update Learning Progress
              </h2>
            </div>

            {progressError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
                {progressError}
              </div>
            )}
            {progressMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {progressMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/20">
                <label className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1.5">
                  Mathematics Level
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.student.levelMax}
                  value={mathLevel}
                  onChange={(e) => setMathLevel(e.target.value)}
                  placeholder="e.g., Ratios & Equations"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-500/10 border border-teal-200/70 dark:border-teal-500/20">
                <label className="block text-sm font-semibold text-teal-800 dark:text-teal-300 mb-1.5">
                  Technology Level
                </label>
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.student.levelMax}
                  value={techLevel}
                  onChange={(e) => setTechLevel(e.target.value)}
                  placeholder="e.g., Loops & Functions"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Learning Goals
              </label>
              <textarea
                rows={3}
                maxLength={BLUEPRINT_LIMITS.student.learningGoalsMax}
                value={learningGoals}
                onChange={(e) => setLearningGoals(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Teacher Progress Summary
              </label>
              <textarea
                rows={5}
                maxLength={BLUEPRINT_LIMITS.student.progressSummaryMax}
                value={progressSummary}
                onChange={(e) => setProgressSummary(e.target.value)}
                placeholder="Strengths, concepts mastered, and next milestones..."
                className={INPUT_CLASS}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProgress}
                className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors disabled:opacity-60"
              >
                {savingProgress ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </form>

          <div className={`lg:col-span-5 ${CARD_CLASS} p-6 space-y-5`}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Session Understanding Log
            </h2>

            {completedReports.length > 0 && (
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800">
                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex gap-0.5">
                  {understandingBreakdown.map((b) => {
                    if (b.count === 0) return null;
                    const pct = (b.count / completedReports.length) * 100;
                    return (
                      <div
                        key={b.level}
                        style={{ width: `${pct}%` }}
                        className={`h-full ${b.barClass}`}
                        title={`${b.label}: ${b.count}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
                  {understandingBreakdown.map((b) => (
                    <span key={b.level} className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${b.barClass}`} />
                      {b.label}: <strong className="font-mono">{b.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {completedReports.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Complete a class session to record understanding milestones.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {completedReports.map((rep) => (
                  <div key={rep.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {rep.topic}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium capitalize rounded-md border shrink-0 ${getUnderstandingBadgeClass(
                          rep.understandingLevel
                        )}`}
                      >
                        {rep.understandingLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                      {rep.sessionDate} · {rep.subject}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'homework' && (
        <div className="space-y-6">
          {/* Student Homework Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className={`${CARD_CLASS} p-4`}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Assignments
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {studentHomework.length}
              </p>
            </div>
            <div className={`${CARD_CLASS} p-4`}>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Completed
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {completedStudentHwCount}
              </p>
            </div>
            <div className={`${CARD_CLASS} p-4`}>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                Pending
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {pendingStudentHwCount}
              </p>
            </div>
            <div
              className={`${CARD_CLASS} p-4 ${
                overdueStudentHwCount > 0
                  ? 'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20'
                  : ''
              }`}
            >
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                Overdue
              </p>
              <p className="text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-300 mt-1">
                {overdueStudentHwCount}
              </p>
            </div>
          </div>

          {/* Homework Assignments List */}
          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Homework History for {student.fullName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingHomework(null);
                  setHwModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Assign Homework
              </button>
            </div>

            {studentHomework.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No homework assigned to {student.fullName} yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentHomework.map((item) => {
                  const effectiveStatus = getEffectiveHomeworkStatus(item, today);
                  return (
                    <div
                      key={item.id}
                      className="px-5 py-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailHomeworkId(item.id)}
                            className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            {item.title}
                          </button>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getHomeworkStatusClass(
                              effectiveStatus
                            )}`}
                          >
                            {effectiveStatus === 'overdue' && (
                              <AlertTriangle className="w-3 h-3" />
                            )}
                            {formatHomeworkStatusLabel(effectiveStatus)}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                              item.subject
                            )}`}
                          >
                            {item.subject}
                          </span>
                          {item.score?.trim() && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30">
                              Score: {item.score}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2">
                          {item.assignedDate && (
                            <>
                              <span className="font-mono tabular-nums">
                                Assigned {item.assignedDate}
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span
                            className={`font-mono tabular-nums ${
                              effectiveStatus === 'overdue'
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : ''
                            }`}
                          >
                            Due {item.dueDate}
                          </span>
                          {item.submittedDate && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-violet-600 dark:text-violet-300">
                                Submitted {item.submittedDate}
                              </span>
                            </>
                          )}
                        </p>
                        {(item.instructions?.trim() || item.questionsOrTasks?.trim()) && (
                          <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 whitespace-pre-wrap">
                            {item.instructions?.trim() || item.questionsOrTasks?.trim()}
                          </p>
                        )}
                        {item.supportingLinks && item.supportingLinks.length > 0 && (
                          <HomeworkLinkBadges links={item.supportingLinks} compact />
                        )}
                        {item.feedback?.trim() && (
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                            Feedback: {item.feedback}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                        <select
                          value={effectiveStatus}
                          onChange={(e) =>
                            void handleHomeworkStatus(
                              item,
                              e.target.value as HomeworkStatus
                            )
                          }
                          aria-label={`Update status for ${item.title}`}
                          className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-[#0E1629] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
                        >
                          <option value={HomeworkStatus.ASSIGNED}>Assigned</option>
                          <option value={HomeworkStatus.SUBMITTED}>Submitted</option>
                          <option value={HomeworkStatus.UNDER_REVIEW}>Under Review</option>
                          <option value={HomeworkStatus.COMPLETED}>Completed</option>
                          <option value={HomeworkStatus.OVERDUE}>Overdue</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setDetailHomeworkId(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          Assess
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingHomework(item);
                            setHwModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
                          aria-label={`Edit ${item.title}`}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteHwTarget(item)}
                          className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                          aria-label={`Delete ${item.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Teacher Feedback */}
          <div className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Recent Teacher Feedback
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {recentHomeworkFeedback.length} recorded
              </span>
            </div>

            {recentHomeworkFeedback.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Teacher feedback and scores recorded on {student.fullName}&apos;s homework will appear here.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentHomeworkFeedback.map((item) => (
                  <div
                    key={`fb-${item.id}`}
                    className="p-5 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailHomeworkId(item.id)}
                        className="text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {item.title}
                      </button>
                      <div className="flex items-center gap-2">
                        {item.score?.trim() && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-teal-50 text-teal-700 border border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30">
                            {item.score}
                          </span>
                        )}
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {item.submittedDate || item.dueDate}
                        </span>
                      </div>
                    </div>
                    {item.feedback?.trim() && (
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                        {item.feedback}
                      </p>
                    )}
                    {item.areasForImprovement?.trim() && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 rounded-lg px-3 py-2">
                        Areas for improvement: {item.areasForImprovement}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'monthly-reports' && (
        <div className={`${CARD_CLASS} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FileBarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Monthly Academic Progress Reports
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Individual monthly progress reports for {student.fullName}.
                </p>
              </div>
            </div>
            {onGenerateMonthlyReport && (
              <button
                type="button"
                onClick={() => onGenerateMonthlyReport(student)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors whitespace-nowrap self-start sm:self-auto"
              >
                <Sparkles className="w-4 h-4" />
                Generate Monthly Report
              </button>
            )}
          </div>

          {studentMonthlyReports.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                No monthly academic progress reports saved for {student.fullName} yet.
              </p>
              {onGenerateMonthlyReport && (
                <button
                  type="button"
                  onClick={() => onGenerateMonthlyReport(student)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Create First Monthly Report
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {studentMonthlyReports.map((rep) => (
                <div
                  key={rep.id}
                  className="px-5 py-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {onOpenMonthlyReport ? (
                        <button
                          type="button"
                          onClick={() => onOpenMonthlyReport(rep)}
                          className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {rep.reportingMonthLabel} Progress Report
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {rep.reportingMonthLabel} Progress Report
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getMonthlyReportStatusClass(
                          rep.status
                        )}`}
                      >
                        {rep.status === MonthlyReportStatus.APPROVED ? 'Approved' : 'Draft'}
                      </span>
                      {rep.subjectAssessments.map((sa) => (
                        <span
                          key={`${rep.id}-${sa.subject}`}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                            sa.subject
                          )}`}
                        >
                          {sa.subject}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {rep.completedClassesCount}{' '}
                      {rep.completedClassesCount === 1 ? 'class' : 'classes'} ·{' '}
                      {rep.homeworkCompletedCount}/{rep.homeworkAssignedCount} homework
                      completed
                    </p>
                    {(rep.overallMonthlyAssessment?.trim() ||
                      rep.topicsCovered?.trim()) && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        {rep.overallMonthlyAssessment?.trim() ||
                          rep.topicsCovered?.trim()}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                    {onOpenMonthlyReport && (
                      <button
                        type="button"
                        onClick={() => onOpenMonthlyReport(rep)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {rep.status === MonthlyReportStatus.DRAFT ? (
                          <>
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Draft
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            View Report
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadMonthlyReportPdf(rep)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteMrTarget(rep)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                      aria-label={`Delete ${rep.reportingMonthLabel} report`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'resources' && (
        <div className={`${CARD_CLASS} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <FolderOpen className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Learning Resources
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setResError(null);
                setResModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Resource
            </button>
          </div>

          {studentResources.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No worksheets, guides, or links attached to {student.fullName} yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {studentResources.map((res) => (
                <div
                  key={res.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {res.title}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                          res.subject
                        )}`}
                      >
                        {res.subject}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                      {res.resourceType}
                    </p>
                    {res.notes && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{res.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {res.url && (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Open Link
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteResTarget(res)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                      aria-label={`Delete ${res.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Student Modal */}
      <StudentFormModal
        open={editModalOpen}
        teacherId={teacherId}
        student={student}
        onClose={() => setEditModalOpen(false)}
      />

      {/* Homework Create / Edit Modal */}
      <HomeworkFormModal
        open={hwModalOpen}
        teacherId={teacherId}
        students={[student]}
        lessonPlans={lessonPlans}
        classReports={classReports}
        editingItem={editingHomework}
        lockedStudent={student}
        onClose={() => {
          setHwModalOpen(false);
          setEditingHomework(null);
        }}
      />

      {/* Homework Submission & Assessment Modal */}
      <HomeworkDetailModal
        item={detailHomework}
        lessonPlans={lessonPlans}
        classReports={classReports}
        onClose={() => setDetailHomeworkId(null)}
        onEditAssignment={(item) => {
          setEditingHomework(item);
          setHwModalOpen(true);
        }}
        onDeleteRequest={(item) => setDeleteHwTarget(item)}
      />

      {/* Add Resource Modal */}
      {resModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Add Learning Resource
              </h3>
              <button
                type="button"
                onClick={() => setResModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {resError && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
                {resError}
              </div>
            )}
            <form onSubmit={handleCreateResource} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_LIMITS.resource.titleMax}
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="e.g., Fractions Visual Guide"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Subject
                  </label>
                  <select
                    value={resSubject}
                    onChange={(e) => setResSubject(e.target.value as Subject)}
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value as ResourceType)}
                    className={INPUT_CLASS}
                  >
                    <option value={ResourceType.WORKSHEET}>Worksheet</option>
                    <option value={ResourceType.GUIDE}>Guide</option>
                    <option value={ResourceType.EXERCISE}>Exercise</option>
                    <option value={ResourceType.LINK}>External Link</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL (optional)
                </label>
                <input
                  type="url"
                  maxLength={BLUEPRINT_LIMITS.resource.urlMax}
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={BLUEPRINT_LIMITS.resource.notesMax}
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRes}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60"
                >
                  {savingRes ? 'Saving...' : 'Save Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteHwTarget)}
        title="Delete homework assignment?"
        description={`Remove "${deleteHwTarget?.title ?? ''}" for ${student.fullName}? This cannot be undone.`}
        confirmLabel="Delete Homework"
        busy={deletingHw}
        onConfirm={() => void handleConfirmDeleteHw()}
        onCancel={() => setDeleteHwTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteResTarget)}
        title="Delete learning resource?"
        description={`Remove "${deleteResTarget?.title ?? ''}" from ${student.fullName}'s resources?`}
        confirmLabel="Delete Resource"
        busy={deletingRes}
        onConfirm={() => void handleConfirmDeleteRes()}
        onCancel={() => setDeleteResTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteMrTarget)}
        title="Delete monthly progress report?"
        description={`Remove ${deleteMrTarget?.reportingMonthLabel ?? ''} monthly report for ${student.fullName}? Class documentation and homework records will not be affected.`}
        confirmLabel="Delete Report"
        busy={deletingMr}
        onConfirm={() => void handleConfirmDeleteMonthlyReport()}
        onCancel={() => setDeleteMrTarget(null)}
      />

      {/* Full Class Record Review Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl my-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {viewingReport.topic}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {viewingReport.subject}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{viewingReport.sessionDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {viewingReport.durationMinutes} min
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize font-medium text-slate-700 dark:text-slate-200">
                    Understanding: {viewingReport.understandingLevel}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                aria-label="Close class record"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
              {(
                [
                  { label: 'Learning Objectives Covered', value: viewingReport.objectivesCovered },
                  { label: 'Concepts Taught', value: viewingReport.conceptsTaught },
                  {
                    label: 'Activities Completed',
                    value: viewingReport.activitiesCompleted || viewingReport.notes,
                  },
                  {
                    label: 'Practical Exercises Performed',
                    value: viewingReport.practicalExercisesPerformed,
                  },
                  { label: 'Classwork Given', value: viewingReport.classworkGiven },
                  {
                    label: 'Student Participation & Responses',
                    value: viewingReport.studentParticipation,
                  },
                  { label: 'Areas Understood Well', value: viewingReport.understoodWell },
                  { label: 'Areas Struggled With', value: viewingReport.struggledWith },
                  {
                    label: 'Challenges Encountered During Class',
                    value: viewingReport.challengesEncountered,
                  },
                  { label: 'Homework Assigned', value: viewingReport.homeworkAssigned },
                  { label: "Teacher's Observations", value: viewingReport.teacherObservations },
                  {
                    label: 'Recommendations & Next Lesson Focus',
                    value:
                      viewingReport.recommendationsNextFocus ||
                      viewingReport.progressNotes,
                  },
                ] as Array<{ label: string; value?: string }>
              ).map((section) => (
                <div
                  key={section.label}
                  className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-b-0 last:pb-0"
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {section.label}
                  </p>
                  {section.value?.trim() ? (
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {section.value}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500">Not recorded.</p>
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E1629] border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              {onOpenClassReport && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingReport;
                    setViewingReport(null);
                    onOpenClassReport(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Open in Class Documentation
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Approved AI Report Viewer Modal */}
      {viewingAiReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-violet-50/70 to-blue-50/70 dark:from-violet-500/15 dark:to-blue-500/15 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {viewingAiReport.lessonTopic}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {viewingAiReport.studentName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-blue-700 dark:text-blue-300">
                    {viewingAiReport.subject}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{viewingAiReport.dateAndDuration}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    Approved Report
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingAiReport(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                aria-label="Close approved AI report"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
              {(
                [
                  {
                    label: 'Learning Objectives Covered',
                    value: viewingAiReport.learningObjectivesCovered,
                  },
                  { label: 'Concepts Taught', value: viewingAiReport.conceptsTaught },
                  {
                    label: 'Activities & Exercises Completed',
                    value: viewingAiReport.activitiesAndExercisesCompleted,
                  },
                  {
                    label: 'Student Participation',
                    value: viewingAiReport.studentParticipation,
                  },
                  {
                    label: 'Demonstrated Understanding',
                    value: viewingAiReport.demonstratedUnderstanding,
                  },
                  {
                    label: 'Areas Requiring Improvement',
                    value: viewingAiReport.areasRequiringImprovement,
                  },
                  {
                    label: 'Challenges Encountered',
                    value: viewingAiReport.challengesEncountered,
                  },
                  { label: 'Homework Assigned', value: viewingAiReport.homeworkAssigned },
                  {
                    label: "Teacher's Observations",
                    value: viewingAiReport.teacherObservations,
                  },
                  {
                    label: 'Recommended Next Steps',
                    value: viewingAiReport.recommendedNextSteps,
                  },
                ] as Array<{ label: string; value?: string }>
              ).map((section) => (
                <div
                  key={section.label}
                  className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-b-0 last:pb-0"
                >
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {section.label}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {section.value?.trim() || 'Not recorded in the class documentation.'}
                  </p>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E1629] border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              {onOpenAiReport && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingAiReport;
                    setViewingAiReport(null);
                    onOpenAiReport(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit in Class Documentation
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingAiReport(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
