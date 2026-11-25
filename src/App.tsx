import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';
import { auth } from './lib/firebase';
import {
  ensureTeacherAndPreloadedStudents,
  subscribeTeacherWorkspace,
  todayIsoDate,
  updateHomework,
} from './lib/firestoreService';
import {
  ClassReportStatus,
  HomeworkStatus,
  Subject,
  type ApprovedAiReport,
  type CanonicalHomeworkStatus,
  type ClassReport,
  type Homework,
  type LessonPlan,
  type MonthlyReport,
  type NavTab,
  type Student,
  type StudentResource,
} from './types/teaching';
import { AuthGate } from './components/AuthGate';
import {
  ClassDocumentationView,
  type StartClassPrefill,
} from './components/ClassDocumentationView';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeworkView, type HomeworkDueDateFilter } from './components/HomeworkView';
import { LessonPlansView } from './components/LessonPlansView';
import { MonthlyReportsView } from './components/MonthlyReportsView';
import { Sidebar } from './components/Sidebar';
import { StudentProfileView } from './components/StudentProfileView';
import { StudentsView } from './components/StudentsView';
import { ThemeProvider } from './lib/theme';

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [preselectedPlanStudent, setPreselectedPlanStudent] = useState<Student | null>(null);
  const [selectedLessonPlanId, setSelectedLessonPlanId] = useState<string | null>(null);
  const [selectedClassReportId, setSelectedClassReportId] = useState<string | null>(null);
  const [selectedAiReportId, setSelectedAiReportId] = useState<string | null>(null);
  const [startClassPrefill, setStartClassPrefill] = useState<StartClassPrefill | null>(null);
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(null);
  const [homeworkStatusFilter, setHomeworkStatusFilter] = useState<
    'all' | CanonicalHomeworkStatus | undefined
  >(undefined);
  const [homeworkDueDatePreset, setHomeworkDueDatePreset] = useState<
    HomeworkDueDateFilter | undefined
  >(undefined);
  const [selectedMonthlyReportId, setSelectedMonthlyReportId] = useState<string | null>(null);
  const [monthlyReportStudentId, setMonthlyReportStudentId] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [classReports, setClassReports] = useState<ClassReport[]>([]);
  const [aiReports, setAiReports] = useState<ApprovedAiReport[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [resources, setResources] = useState<StudentResource[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);

  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setStudents([]);
        setLessonPlans([]);
        setClassReports([]);
        setAiReports([]);
        setHomework([]);
        setResources([]);
        setMonthlyReports([]);
        setSelectedStudentId(null);
        setSelectedHomeworkId(null);
        setSelectedMonthlyReportId(null);
        setMonthlyReportStudentId(null);
        setHomeworkStatusFilter(undefined);
        setHomeworkDueDatePreset(undefined);
        setActiveTab('dashboard');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubWorkspace: (() => void) | undefined;

    setWorkspaceLoading(true);
    setWorkspaceError(null);

    ensureTeacherAndPreloadedStudents(user)
      .then(() => {
        if (cancelled) return;
        unsubWorkspace = subscribeTeacherWorkspace(user.uid, {
          onStudents: (list) => {
            setStudents(list);
            setWorkspaceLoading(false);
          },
          onLessonPlans: (list) => setLessonPlans(list),
          onClassReports: (list) => setClassReports(list),
          onAiReports: (list) => setAiReports(list),
          onHomework: (list) => setHomework(list),
          onResources: (list) => setResources(list),
          onMonthlyReports: (list) => setMonthlyReports(list),
          onError: (msg) => {
            setWorkspaceError(msg);
            setWorkspaceLoading(false);
          },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setWorkspaceError(
          err instanceof Error
            ? err.message
            : 'Unable to initialize your teaching workspace.'
        );
        setWorkspaceLoading(false);
      });

    return () => {
      cancelled = true;
      unsubWorkspace?.();
    };
  }, [authReady, user]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#0A1020] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading YoungAndCode Teaching Manager...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const hasLiveClass = classReports.some(
    (r) => r.status === ClassReportStatus.IN_PROGRESS
  );
  const selectedStudent = selectedStudentId
    ? students.find((s) => s.id === selectedStudentId) ?? null
    : null;
  const teacherName = user.displayName || user.email?.split('@')[0] || 'Teacher';

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setSelectedStudentId(null);
  };

  const handleOpenStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('students');
  };

  const handleStartClassFromPlan = (plan: LessonPlan) => {
    setStartClassPrefill({
      studentId: plan.studentId,
      subject: plan.subject,
      topic: plan.topic,
      lessonPlanId: plan.id,
    });
    setSelectedStudentId(null);
    setActiveTab('class-sessions');
  };

  const handleStartClassFromStudent = (student: Student) => {
    setStartClassPrefill({
      studentId: student.id,
      subject: student.subjects[0] ?? Subject.TECHNOLOGY,
    });
    setSelectedStudentId(null);
    setActiveTab('class-sessions');
  };

  const handlePlanLessonFromStudent = (student: Student) => {
    setPreselectedPlanStudent(student);
    setSelectedStudentId(null);
    setActiveTab('lesson-plans');
  };

  const handleOpenLessonPlan = (plan: LessonPlan) => {
    setSelectedLessonPlanId(plan.id);
    setSelectedStudentId(null);
    setActiveTab('lesson-plans');
  };

  const handleOpenClassReport = (report: ClassReport) => {
    setSelectedClassReportId(report.id);
    setSelectedAiReportId(null);
    setSelectedStudentId(null);
    setActiveTab('class-sessions');
  };

  const handleOpenAiReport = (aiReport: ApprovedAiReport) => {
    setSelectedAiReportId(aiReport.id);
    setSelectedClassReportId(null);
    setSelectedStudentId(null);
    setActiveTab('class-sessions');
  };

  const handleQuickHomeworkStatus = async (
    item: Homework,
    nextStatus: HomeworkStatus
  ) => {
    const needsSubmittedDate =
      (nextStatus === HomeworkStatus.SUBMITTED ||
        nextStatus === HomeworkStatus.UNDER_REVIEW ||
        nextStatus === HomeworkStatus.COMPLETED) &&
      !item.submittedDate;

    await updateHomework(item.id, {
      status: nextStatus,
      ...(needsSubmittedDate ? { submittedDate: todayIsoDate() } : {}),
    });
  };

  const handleOpenHomework = (item: Homework) => {
    setSelectedHomeworkId(item.id);
    setHomeworkStatusFilter('all');
    setHomeworkDueDatePreset('all');
    setSelectedStudentId(null);
    setActiveTab('homework');
  };

  const handleOpenHomeworkFilter = (opts: {
    status?: 'all' | CanonicalHomeworkStatus;
    dueDatePreset?: HomeworkDueDateFilter;
  }) => {
    setSelectedHomeworkId(null);
    setHomeworkStatusFilter(opts.status ?? 'all');
    setHomeworkDueDatePreset(opts.dueDatePreset ?? 'all');
    setSelectedStudentId(null);
    setActiveTab('homework');
  };

  const handleOpenMonthlyReport = (report: MonthlyReport) => {
    setSelectedMonthlyReportId(report.id);
    setMonthlyReportStudentId(null);
    setSelectedStudentId(null);
    setActiveTab('monthly-reports');
  };

  const handleGenerateMonthlyReportFromStudent = (student: Student) => {
    setSelectedMonthlyReportId(null);
    setMonthlyReportStudentId(student.id);
    setSelectedStudentId(null);
    setActiveTab('monthly-reports');
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#0A1020] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row transition-colors duration-150">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        user={user}
        onSignOut={() => signOut(auth)}
        hasLiveClass={hasLiveClass}
      />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 print:p-0">
        <div className="max-w-6xl mx-auto">
          {workspaceError && (
            <div
              role="alert"
              className="no-print mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-start gap-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{workspaceError}</span>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              teacherName={teacherName}
              students={students}
              lessonPlans={lessonPlans}
              classReports={classReports}
              homework={homework}
              loading={workspaceLoading}
              onNavigate={handleSelectTab}
              onOpenStudent={handleOpenStudent}
              onStartClassFromPlan={handleStartClassFromPlan}
              onQuickHomeworkStatus={handleQuickHomeworkStatus}
              onOpenHomework={handleOpenHomework}
              onOpenHomeworkFilter={handleOpenHomeworkFilter}
            />
          )}

          {activeTab === 'students' && !selectedStudent && (
            <StudentsView
              teacherId={user.uid}
              students={students}
              classReports={classReports}
              homework={homework}
              loading={workspaceLoading}
              onOpenProfile={handleOpenStudent}
            />
          )}

          {activeTab === 'students' && selectedStudent && (
            <StudentProfileView
              teacherId={user.uid}
              student={selectedStudent}
              lessonPlans={lessonPlans}
              classReports={classReports}
              aiReports={aiReports}
              homework={homework}
              resources={resources}
              monthlyReports={monthlyReports}
              onBack={() => setSelectedStudentId(null)}
              onStartClass={handleStartClassFromStudent}
              onPlanLesson={handlePlanLessonFromStudent}
              onOpenLessonPlan={handleOpenLessonPlan}
              onOpenClassReport={handleOpenClassReport}
              onOpenAiReport={handleOpenAiReport}
              onOpenMonthlyReport={handleOpenMonthlyReport}
              onGenerateMonthlyReport={handleGenerateMonthlyReportFromStudent}
            />
          )}

          {activeTab === 'lesson-plans' && (
            <LessonPlansView
              teacherId={user.uid}
              students={students}
              lessonPlans={lessonPlans}
              loading={workspaceLoading}
              preselectedStudent={preselectedPlanStudent}
              onClearPreselectedStudent={() => setPreselectedPlanStudent(null)}
              initialPlanId={selectedLessonPlanId}
              onClearInitialPlanId={() => setSelectedLessonPlanId(null)}
              onStartClassFromPlan={handleStartClassFromPlan}
            />
          )}

          {activeTab === 'class-sessions' && (
            <ClassDocumentationView
              teacherId={user.uid}
              students={students}
              lessonPlans={lessonPlans}
              classReports={classReports}
              aiReports={aiReports}
              loading={workspaceLoading}
              prefill={startClassPrefill}
              onClearPrefill={() => setStartClassPrefill(null)}
              initialReportId={selectedClassReportId}
              onClearInitialReportId={() => setSelectedClassReportId(null)}
              initialAiReportId={selectedAiReportId}
              onClearInitialAiReportId={() => setSelectedAiReportId(null)}
            />
          )}

          {activeTab === 'homework' && (
            <HomeworkView
              teacherId={user.uid}
              students={students}
              lessonPlans={lessonPlans}
              classReports={classReports}
              homework={homework}
              loading={workspaceLoading}
              initialHomeworkId={selectedHomeworkId}
              onClearInitialHomeworkId={() => setSelectedHomeworkId(null)}
              initialStatusFilter={homeworkStatusFilter}
              onClearInitialStatusFilter={() => setHomeworkStatusFilter(undefined)}
              initialDueDatePreset={homeworkDueDatePreset}
              onClearInitialDueDatePreset={() => setHomeworkDueDatePreset(undefined)}
              onOpenStudent={handleOpenStudent}
            />
          )}

          {activeTab === 'monthly-reports' && (
            <MonthlyReportsView
              teacherId={user.uid}
              teacherName={teacherName}
              students={students}
              lessonPlans={lessonPlans}
              classReports={classReports}
              aiReports={aiReports}
              homework={homework}
              monthlyReports={monthlyReports}
              loading={workspaceLoading}
              initialStudentId={monthlyReportStudentId}
              onClearInitialStudentId={() => setMonthlyReportStudentId(null)}
              initialReportId={selectedMonthlyReportId}
              onClearInitialReportId={() => setSelectedMonthlyReportId(null)}
              onOpenStudent={handleOpenStudent}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <WorkspaceApp />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
