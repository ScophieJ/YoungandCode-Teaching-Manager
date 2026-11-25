import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileCheck,
  GraduationCap,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ClassReportStatus,
  formatHomeworkStatusLabel,
  getEffectiveHomeworkStatus,
  HomeworkStatus,
  isScheduledLessonStatus,
  localTodayIso,
  StudentStatus,
  Subject,
  UnderstandingLevel,
  type CanonicalHomeworkStatus,
  type ClassReport,
  type Homework,
  type LessonPlan,
  type NavTab,
  type Student,
} from '../types/teaching';
import {
  CARD_CLASS,
  getHomeworkStatusClass,
  getStudentAvatarGradient,
  getStudentInitials,
  getSubjectBadgeClass,
  getUnderstandingBadgeClass,
} from '../lib/uiTokens';
import type { HomeworkDueDateFilter } from './HomeworkView';

type DashboardHwBucket = 'pending' | 'submitted' | 'overdue' | 'upcoming';

interface DashboardViewProps {
  teacherName?: string;
  students: Student[];
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  homework: Homework[];
  loading: boolean;
  onNavigate: (tab: NavTab) => void;
  onOpenStudent: (studentId: string) => void;
  onStartClassFromPlan: (plan: LessonPlan) => void;
  onQuickHomeworkStatus: (item: Homework, nextStatus: HomeworkStatus) => Promise<void>;
  onOpenHomework: (item: Homework) => void;
  onOpenHomeworkFilter: (opts: {
    status?: 'all' | CanonicalHomeworkStatus;
    dueDatePreset?: HomeworkDueDateFilter;
  }) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardView({
  teacherName = 'Teacher',
  students,
  lessonPlans,
  classReports,
  homework,
  loading,
  onNavigate,
  onOpenStudent,
  onStartClassFromPlan,
  onQuickHomeworkStatus,
  onOpenHomework,
  onOpenHomeworkFilter,
}: DashboardViewProps) {
  const [hwBucket, setHwBucket] = useState<DashboardHwBucket>('pending');
  const today = localTodayIso();
  const firstName = teacherName.trim().split(/\s+/)[0] || 'Teacher';

  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const archivedCount = students.length - activeStudents.length;

  const completedClasses = classReports.filter(
    (r) => r.status === ClassReportStatus.COMPLETED
  );
  const liveClass = classReports.find((r) => r.status === ClassReportStatus.IN_PROGRESS);

  const upcomingLessons = lessonPlans
    .filter((p) => isScheduledLessonStatus(p.status))
    .slice(0, 6);
  const upcomingCount = lessonPlans.filter(
    (p) => isScheduledLessonStatus(p.status)
  ).length;

  const pendingHomework = homework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) !== 'completed'
  );
  const recentlySubmittedHomework = homework
    .filter((h) => {
      const st = getEffectiveHomeworkStatus(h, today);
      return st === 'submitted' || st === 'under_review';
    })
    .sort((a, b) => {
      const subCmp = (b.submittedDate || '').localeCompare(a.submittedDate || '');
      if (subCmp !== 0) return subCmp;
      return (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
    });
  const overdueHomework = homework
    .filter((h) => getEffectiveHomeworkStatus(h, today) === 'overdue')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcomingDeadlinesHomework = homework
    .filter((h) => {
      const st = getEffectiveHomeworkStatus(h, today);
      return st === 'assigned' && h.dueDate >= today;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const activeBucketItems =
    hwBucket === 'submitted'
      ? recentlySubmittedHomework
      : hwBucket === 'overdue'
        ? overdueHomework
        : hwBucket === 'upcoming'
          ? upcomingDeadlinesHomework
          : pendingHomework;

  const recentReports = completedClasses.slice(0, 5);

  // Real Analytics: Subject breakdown across completed classes
  const mathCompletedCount = completedClasses.filter(
    (r) => r.subject === Subject.MATHEMATICS
  ).length;
  const techCompletedCount = completedClasses.filter(
    (r) => r.subject === Subject.TECHNOLOGY
  ).length;
  const totalCompleted = completedClasses.length;
  const mathPercent = totalCompleted > 0 ? Math.round((mathCompletedCount / totalCompleted) * 100) : 0;
  const techPercent = totalCompleted > 0 ? 100 - mathPercent : 0;

  // Real Analytics: Understanding level distribution
  const understandingCounts = [
    {
      level: UnderstandingLevel.MASTERED,
      label: 'Mastered',
      count: completedClasses.filter((r) => r.understandingLevel === UnderstandingLevel.MASTERED).length,
      barClass: 'bg-teal-500',
      dotClass: 'bg-teal-500',
    },
    {
      level: UnderstandingLevel.STRONG,
      label: 'Strong',
      count: completedClasses.filter((r) => r.understandingLevel === UnderstandingLevel.STRONG).length,
      barClass: 'bg-blue-500',
      dotClass: 'bg-blue-500',
    },
    {
      level: UnderstandingLevel.STEADY,
      label: 'Steady',
      count: completedClasses.filter((r) => r.understandingLevel === UnderstandingLevel.STEADY).length,
      barClass: 'bg-violet-500',
      dotClass: 'bg-violet-500',
    },
    {
      level: UnderstandingLevel.DEVELOPING,
      label: 'Developing',
      count: completedClasses.filter((r) => r.understandingLevel === UnderstandingLevel.DEVELOPING).length,
      barClass: 'bg-orange-500',
      dotClass: 'bg-orange-500',
    },
  ];

  // Real Analytics: Homework completion breakdown
  const hwAssignedCount = homework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'assigned'
  ).length;
  const hwSubmittedCount = recentlySubmittedHomework.length;
  const hwOverdueCount = overdueHomework.length;
  const hwCompletedCount = homework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'completed'
  ).length;
  const totalHwCount = homework.length;
  const hwCompletedPct =
    totalHwCount > 0 ? Math.round((hwCompletedCount / totalHwCount) * 100) : 0;
  const ringRadius = 34;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference - (hwCompletedPct / 100) * ringCircumference;

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#4338CA] text-white p-6 sm:p-7 shadow-lg shadow-blue-950/15">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full bg-violet-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 w-64 h-64 rounded-full bg-teal-400/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 tabular-nums">
              {formattedDate}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-sm text-blue-100/90 max-w-2xl">
              {loading
                ? 'Syncing your Mathematics and Technology workspace...'
                : `Managing ${activeStudents.length} active ${
                    activeStudents.length === 1 ? 'student' : 'students'
                  }, ${upcomingCount} upcoming ${
                    upcomingCount === 1 ? 'lesson' : 'lessons'
                  }, and ${pendingHomework.length} pending homework ${
                    pendingHomework.length === 1 ? 'task' : 'tasks'
                  }.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('lesson-plans')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-white bg-white/12 hover:bg-white/20 border border-white/20 rounded-xl transition-colors whitespace-nowrap shrink-0 backdrop-blur-xs"
            >
              <Plus className="w-4 h-4" />
              Plan Lesson
            </button>
            <button
              type="button"
              onClick={() => onNavigate('homework')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-white bg-white/12 hover:bg-white/20 border border-white/20 rounded-xl transition-colors whitespace-nowrap shrink-0 backdrop-blur-xs"
            >
              <CheckSquare className="w-4 h-4" />
              Assign Homework
            </button>
            <button
              type="button"
              onClick={() => onNavigate('class-sessions')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-900 bg-white hover:bg-blue-50 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
            >
              <ClipboardCheck className="w-4 h-4 text-blue-600" />
              {liveClass ? 'Resume Active Class' : 'Start a Class'}
            </button>
          </div>
        </div>
      </section>

      {/* Live class banner when a session is in progress */}
      {liveClass && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-teal-50/60 dark:from-blue-500/15 dark:via-indigo-500/15 dark:to-teal-500/10 border border-blue-200 dark:border-blue-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-950 dark:text-blue-200">
                Class in progress: {liveClass.studentName} · {liveClass.subject}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">
                Topic: {liveClass.topic}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('class-sessions')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Open Class Session
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4-column Colorful KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="group text-left bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Total Students
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 dark:from-blue-500/20 dark:to-indigo-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums font-mono">
              {activeStudents.length}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {archivedCount > 0 ? `${archivedCount} archived profiles` : 'Active teaching roster'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('class-sessions')}
          className="group text-left bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Classes Completed
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 dark:from-teal-500/20 dark:to-emerald-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums font-mono">
              {completedClasses.length}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Documented class reports
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('lesson-plans')}
          className="group text-left bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Upcoming Lessons
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/15 dark:from-violet-500/20 dark:to-purple-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums font-mono">
              {upcomingCount}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Scheduled lesson plans
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('homework')}
          className="group text-left bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 hover:border-orange-300 dark:hover:border-orange-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Pending Homework
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/15 dark:from-orange-500/20 dark:to-amber-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums font-mono">
              {pendingHomework.length}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {hwOverdueCount > 0
              ? `${hwOverdueCount} overdue · ${hwSubmittedCount} submitted`
              : 'Awaiting completion or review'}
          </p>
        </button>
      </div>

      {/* Learning Progress Visualizations (Live Firestore Metrics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className={`lg:col-span-7 ${CARD_CLASS} p-5 sm:p-6`}>
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Learning Understanding &amp; Subject Balance
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Computed from your completed class documentation
                </p>
              </div>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300">
              {totalCompleted} {totalCompleted === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            </div>
          ) : totalCompleted === 0 ? (
            <div className="p-6 rounded-xl bg-slate-50/80 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800 text-center">
              <TrendingUp className="w-7 h-7 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No completed classes documented yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                Complete your first Mathematics or Technology class report to visualize student understanding trends.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('class-sessions')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Start a Class
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Understanding Distribution Stacked Bar */}
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                  <span>Student Understanding Breakdown</span>
                  <span className="font-mono tabular-nums">{totalCompleted} rated</span>
                </div>
                <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5 p-0.5">
                  {understandingCounts.map((item) => {
                    if (item.count === 0) return null;
                    const widthPct = (item.count / totalCompleted) * 100;
                    return (
                      <div
                        key={item.level}
                        style={{ width: `${widthPct}%` }}
                        className={`h-full first:rounded-l-full last:rounded-r-full ${item.barClass} transition-all`}
                        title={`${item.label}: ${item.count}`}
                      />
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
                  {understandingCounts.map((item) => (
                    <div
                      key={item.level}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-[#0E1629] border border-slate-200/70 dark:border-slate-800"
                    >
                      <span className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass}`} />
                        {item.label}
                      </span>
                      <span className="text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      Mathematics
                    </span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {mathCompletedCount} ({mathPercent}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-blue-100/80 dark:bg-blue-950/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all"
                      style={{ width: `${mathPercent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-teal-700 dark:text-teal-300">
                      Technology
                    </span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {techCompletedCount} ({techPercent}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-teal-100/80 dark:bg-teal-950/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
                      style={{ width: `${techPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Analytics Card: Homework Ring + Student Progress */}
        <section className={`lg:col-span-5 ${CARD_CLASS} p-5 sm:p-6 flex flex-col justify-between gap-5`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Homework Completion
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reviewed vs active assignments
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('homework')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              View all
            </button>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 84 84" aria-hidden="true">
                <circle
                  cx="42"
                  cy="42"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="8"
                  className="stroke-slate-100 dark:stroke-slate-800"
                />
                <circle
                  cx="42"
                  cy="42"
                  r={ringRadius}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                  className="stroke-teal-500 transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {hwCompletedPct}%
                </span>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Completed
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              <button
                type="button"
                onClick={() => onOpenHomeworkFilter({ status: 'assigned' })}
                className="w-full flex items-center justify-between text-xs hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Assigned
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {hwAssignedCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenHomeworkFilter({ status: 'submitted' })}
                className="w-full flex items-center justify-between text-xs hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  Submitted / Review
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {hwSubmittedCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenHomeworkFilter({ status: 'overdue' })}
                className="w-full flex items-center justify-between text-xs hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  Overdue
                </span>
                <span className="font-mono tabular-nums font-semibold text-red-600 dark:text-red-400">
                  {hwOverdueCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onOpenHomeworkFilter({ status: 'completed' })}
                className="w-full flex items-center justify-between text-xs hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              >
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  Completed
                </span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {hwCompletedCount}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Sessions per active student
            </p>
            {activeStudents.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No active students yet.
              </p>
            ) : (
              <div className="space-y-2">
                {activeStudents.slice(0, 3).map((st) => {
                  const stDone = completedClasses.filter((c) => c.studentId === st.id).length;
                  const maxDone = Math.max(
                    1,
                    ...activeStudents.map(
                      (s) => completedClasses.filter((c) => c.studentId === s.id).length
                    )
                  );
                  const barPct = stDone > 0 ? Math.max(12, Math.round((stDone / maxDone) * 100)) : 0;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onOpenStudent(st.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                          {st.fullName}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                          {stDone} {stDone === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500 transition-all"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Main two-column dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upcoming Lessons */}
        <section className={`lg:col-span-7 ${CARD_CLASS} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <CalendarClock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Upcoming Lessons
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('lesson-plans')}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            </div>
          ) : upcomingLessons.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                No upcoming lesson plans scheduled yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('lesson-plans')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Lesson Plan
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingLessons.map((plan) => (
                <div
                  key={plan.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {plan.topic}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                          plan.subject
                        )}`}
                      >
                        {plan.subject}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        onClick={() => onOpenStudent(plan.studentId)}
                        className="font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {plan.studentName}
                      </button>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {plan.scheduledDate}
                        {plan.scheduledTime ? ` ${plan.scheduledTime}` : ''}
                      </span>
                      {plan.durationMinutes && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{plan.durationMinutes}m</span>
                        </>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartClassFromPlan(plan)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200/70 dark:border-blue-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    Start Class
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Pending Homework & Recent Class Reports */}
        <div className="lg:col-span-5 space-y-6">
          <section className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Homework Hub
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('homework')}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
              >
                Manage all
              </button>
            </div>

            {/* 4 Clickable Homework Stat Selectors */}
            <div className="p-3 bg-slate-50/80 dark:bg-[#0E1629] border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  {
                    id: 'pending',
                    label: 'Pending',
                    count: pendingHomework.length,
                    icon: Clock,
                    accent: 'text-blue-600 dark:text-blue-400',
                  },
                  {
                    id: 'submitted',
                    label: 'Submitted',
                    count: recentlySubmittedHomework.length,
                    icon: FileCheck,
                    accent: 'text-violet-600 dark:text-violet-400',
                  },
                  {
                    id: 'overdue',
                    label: 'Overdue',
                    count: overdueHomework.length,
                    icon: AlertTriangle,
                    accent: 'text-red-600 dark:text-red-400',
                  },
                  {
                    id: 'upcoming',
                    label: 'Upcoming',
                    count: upcomingDeadlinesHomework.length,
                    icon: Calendar,
                    accent: 'text-teal-600 dark:text-teal-400',
                  },
                ] as Array<{
                  id: DashboardHwBucket;
                  label: string;
                  count: number;
                  icon: typeof Clock;
                  accent: string;
                }>
              ).map((bucket) => {
                const Icon = bucket.icon;
                const active = hwBucket === bucket.id;
                return (
                  <button
                    key={bucket.id}
                    type="button"
                    onClick={() => setHwBucket(bucket.id)}
                    className={`text-left px-2.5 py-2 rounded-xl border transition-all ${
                      active
                        ? 'bg-white dark:bg-[#1B2847] border-blue-300 dark:border-blue-500/50 shadow-xs'
                        : 'bg-transparent border-transparent hover:bg-white/70 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Icon className={`w-3.5 h-3.5 ${bucket.accent}`} />
                      <span className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {bucket.count}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 truncate">
                      {bucket.label}
                    </p>
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-11 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              </div>
            ) : activeBucketItems.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                  {hwBucket === 'overdue'
                    ? 'No overdue homework assignments.'
                    : hwBucket === 'submitted'
                      ? 'No recently submitted homework awaiting review.'
                      : hwBucket === 'upcoming'
                        ? 'No upcoming homework deadlines.'
                        : 'No pending homework assignments.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('homework')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Assign Homework
                </button>
              </div>
            ) : (
              <div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeBucketItems.slice(0, 5).map((item) => {
                    const effectiveStatus = getEffectiveHomeworkStatus(item, today);
                    return (
                      <div
                        key={item.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenHomework(item)}
                          className="min-w-0 flex-1 text-left group"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                              {item.title}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${getHomeworkStatusClass(
                                effectiveStatus
                              )}`}
                            >
                              {formatHomeworkStatusLabel(effectiveStatus)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span>{item.studentName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.subject}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`font-mono tabular-nums ${
                                effectiveStatus === 'overdue'
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : ''
                              }`}
                            >
                              Due {item.dueDate}
                            </span>
                          </p>
                        </button>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {effectiveStatus === 'assigned' || effectiveStatus === 'overdue' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void onQuickHomeworkStatus(item, HomeworkStatus.SUBMITTED)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <FileCheck className="w-3.5 h-3.5 text-violet-500" />
                              Submitted
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void onQuickHomeworkStatus(item, HomeworkStatus.COMPLETED)
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-[#0E1629] border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    Click any assignment to review or grade
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (hwBucket === 'overdue') {
                        onOpenHomeworkFilter({ status: 'overdue' });
                      } else if (hwBucket === 'submitted') {
                        onOpenHomeworkFilter({ status: 'submitted' });
                      } else if (hwBucket === 'upcoming') {
                        onOpenHomeworkFilter({ dueDatePreset: 'next_7_days' });
                      } else {
                        onOpenHomeworkFilter({ status: 'all' });
                      }
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    Open filtered view
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={`${CARD_CLASS} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Recent Class Reports
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('class-sessions')}
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
              >
                All reports
              </button>
            </div>

            {recentReports.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Completed class reports will appear here after your first session.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="px-5 py-3.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {rep.topic}
                      </p>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium capitalize rounded-md border shrink-0 ${getUnderstandingBadgeClass(
                          rep.understandingLevel
                        )}`}
                      >
                        {rep.understandingLevel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenStudent(rep.studentId)}
                        className="font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {rep.studentName}
                      </button>
                      <span aria-hidden="true">·</span>
                      <span>{rep.subject}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{rep.sessionDate}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{rep.durationMinutes}m</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Active Roster Cards */}
      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Active Students
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('students')}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap"
          >
            Manage students
          </button>
        </div>

        {activeStudents.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No active students found. Add a student to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            {activeStudents.slice(0, 6).map((student) => {
              const studentClasses = completedClasses.filter(
                (c) => c.studentId === student.id
              ).length;
              const studentPendingHw = pendingHomework.filter(
                (h) => h.studentId === student.id
              ).length;
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => onOpenStudent(student.id)}
                  className="text-left p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3.5"
                >
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                      student.fullName
                    )} text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-xs`}
                  >
                    {getStudentInitials(student.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {student.fullName}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {student.subjects.map((subj) => (
                        <span
                          key={subj}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                            subj
                          )}`}
                        >
                          {subj}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 tabular-nums">
                      {studentClasses} {studentClasses === 1 ? 'class' : 'classes'} completed
                      {' · '}
                      {studentPendingHw} pending hw
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
