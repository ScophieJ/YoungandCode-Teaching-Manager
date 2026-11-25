import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  Eye,
  FileBarChart2,
  FileCheck2,
  FilterX,
  Loader2,
  Printer,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  MonthlyReportStatus,
  StudentStatus,
  type ApprovedAiReport,
  type ClassReport,
  type Homework,
  type LessonPlan,
  type MonthlyReport,
  type MonthlyReportDraft,
  type Student,
} from '../types/teaching';
import { generateAiMonthlyReport } from '../lib/aiReportService';
import { deleteMonthlyReport } from '../lib/firestoreService';
import {
  compileMonthlyStudentRecords,
  formatMonthKey,
  getStudentAvailableMonths,
  MONTH_NAMES,
} from '../lib/monthlyReportCompiler';
import { downloadMonthlyReportPdf } from '../lib/monthlyReportPdf';
import {
  CARD_CLASS,
  FILTER_INPUT_CLASS,
  getMonthlyReportStatusClass,
  getStudentAvatarGradient,
  getStudentInitials,
  INPUT_CLASS,
} from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';
import { MonthlyReportEditor } from './MonthlyReportEditor';

interface MonthlyReportsViewProps {
  teacherId: string;
  teacherName: string;
  students: Student[];
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  aiReports: ApprovedAiReport[];
  homework: Homework[];
  monthlyReports: MonthlyReport[];
  loading: boolean;
  initialStudentId?: string | null;
  onClearInitialStudentId?: () => void;
  initialReportId?: string | null;
  onClearInitialReportId?: () => void;
  onOpenStudent?: (studentId: string) => void;
}

export function MonthlyReportsView({
  teacherId,
  teacherName,
  students,
  lessonPlans,
  classReports,
  aiReports,
  homework,
  monthlyReports,
  loading,
  initialStudentId,
  onClearInitialStudentId,
  initialReportId,
  onClearInitialReportId,
  onOpenStudent,
}: MonthlyReportsViewProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const selectableStudents = activeStudents.length > 0 ? activeStudents : students;

  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Active editor session (either an unsaved AI draft or a saved MonthlyReport ID)
  const [editorState, setEditorState] = useState<{
    studentId: string;
    savedReportId: string | null;
    draft: MonthlyReportDraft;
    sourceYear: number;
    sourceMonth: number;
  } | null>(null);

  // History filters
  const [search, setSearch] = useState('');
  const [filterStudentId, setFilterStudentId] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | MonthlyReportStatus>('all');

  const [deleteTarget, setDeleteTarget] = useState<MonthlyReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Default student selection once loaded
  useEffect(() => {
    if (!selectedStudentId && selectableStudents.length > 0) {
      setSelectedStudentId(selectableStudents[0].id);
    }
  }, [selectableStudents, selectedStudentId]);

  // Deep-link preselected student from Student Profile
  useEffect(() => {
    if (!initialStudentId) return;
    if (students.some((s) => s.id === initialStudentId)) {
      setSelectedStudentId(initialStudentId);
      setFilterStudentId(initialStudentId);
      setEditorState(null);
      setGenError(null);
    }
    onClearInitialStudentId?.();
  }, [initialStudentId, students, onClearInitialStudentId]);

  // Deep-link to open a specific saved MonthlyReport
  useEffect(() => {
    if (!initialReportId) return;
    const match = monthlyReports.find((r) => r.id === initialReportId);
    if (match) {
      setEditorState({
        studentId: match.studentId,
        savedReportId: match.id,
        draft: match,
        sourceYear: match.reportYear,
        sourceMonth: match.reportMonth,
      });
      setGenError(null);
      onClearInitialReportId?.();
    }
  }, [initialReportId, monthlyReports, onClearInitialReportId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) ?? null;

  const yearOptions = Array.from(
    new Set([
      currentYear - 1,
      currentYear,
      currentYear + 1,
      ...classReports.map((r) => Number(r.sessionDate.slice(0, 4))).filter((y) => y >= 2020),
      ...monthlyReports.map((r) => r.reportYear).filter((y) => y >= 2020),
    ])
  ).sort((a, b) => b - a);

  const compiledPreview = selectedStudent
    ? compileMonthlyStudentRecords({
        student: selectedStudent,
        year: selectedYear,
        month: selectedMonth,
        classReports,
        approvedAiReports: aiReports,
        lessonPlans,
        homework,
      })
    : null;

  const studentActiveMonths = selectedStudent
    ? getStudentAvailableMonths(selectedStudent.id, classReports, aiReports, homework)
    : [];

  const currentMonthKey = formatMonthKey(selectedYear, selectedMonth);
  const existingForSelection = selectedStudent
    ? monthlyReports.find(
        (r) => r.studentId === selectedStudent.id && r.monthKey === currentMonthKey
      ) ?? null
    : null;

  const runGenerate = async (studentObj: Student, year: number, month: number, existingSavedId: string | null = null) => {
    setGenError(null);
    setGenerating(true);
    try {
      const compiled = compileMonthlyStudentRecords({
        student: studentObj,
        year,
        month,
        classReports,
        approvedAiReports: aiReports,
        lessonPlans,
        homework,
      });
      const generatedDraft = await generateAiMonthlyReport(compiled);
      setEditorState({
        studentId: studentObj.id,
        savedReportId: existingSavedId,
        draft: generatedDraft,
        sourceYear: year,
        sourceMonth: month,
      });
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : 'Unable to generate the monthly progress report right now.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenSaved = (rep: MonthlyReport) => {
    setGenError(null);
    setActionError(null);
    setEditorState({
      studentId: rep.studentId,
      savedReportId: rep.id,
      draft: rep,
      sourceYear: rep.reportYear,
      sourceMonth: rep.reportMonth,
    });
  };

  const handlePrintSaved = (rep: MonthlyReport) => {
    handleOpenSaved(rep);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteMonthlyReport(deleteTarget.id);
      if (editorState?.savedReportId === deleteTarget.id) {
        setEditorState(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete monthly progress report.'
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Active Report Review / Edit / Document View
  if (editorState) {
    const liveSaved = editorState.savedReportId
      ? monthlyReports.find((r) => r.id === editorState.savedReportId) ?? null
      : null;
    const editorStudent = students.find((s) => s.id === editorState.studentId);

    return (
      <MonthlyReportEditor
        teacherId={teacherId}
        teacherName={teacherName}
        studentId={editorState.studentId}
        savedReport={liveSaved}
        initialDraft={editorState.draft}
        regenerating={generating}
        onRegenerate={
          editorStudent
            ? () =>
                runGenerate(
                  editorStudent,
                  editorState.sourceYear,
                  editorState.sourceMonth,
                  liveSaved?.status === MonthlyReportStatus.DRAFT ? liveSaved.id : null
                )
            : undefined
        }
        onSavedReport={(reportId) =>
          setEditorState((prev) =>
            prev ? { ...prev, savedReportId: reportId } : null
          )
        }
        onDeleted={() => setEditorState(null)}
        onBack={() => setEditorState(null)}
        onOpenStudent={onOpenStudent}
      />
    );
  }

  // History filtering
  const normalizedSearch = search.trim().toLowerCase();
  const filteredHistory = monthlyReports.filter((rep) => {
    if (filterStudentId !== 'all' && rep.studentId !== filterStudentId) return false;
    if (filterYear !== 'all' && String(rep.reportYear) !== filterYear) return false;
    if (filterMonth !== 'all' && String(rep.reportMonth) !== filterMonth) return false;
    if (filterStatus !== 'all' && rep.status !== filterStatus) return false;
    if (normalizedSearch) {
      const hay = `${rep.studentName} ${rep.reportingMonthLabel} ${rep.subjectsCovered} ${rep.topicsCovered} ${rep.conclusion}`.toLowerCase();
      if (!hay.includes(normalizedSearch)) return false;
    }
    return true;
  });

  const approvedCount = monthlyReports.filter(
    (r) => r.status === MonthlyReportStatus.APPROVED
  ).length;
  const draftCount = monthlyReports.filter(
    (r) => r.status === MonthlyReportStatus.DRAFT
  ).length;

  const hasFilters =
    Boolean(search.trim()) ||
    filterStudentId !== 'all' ||
    filterYear !== 'all' ||
    filterMonth !== 'all' ||
    filterStatus !== 'all';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Monthly Academic Progress Reports
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Compile individual student progress from completed classes, approved AI reports, and homework records, then review, approve, and export as PDF.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Saved: </span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
              {approvedCount} approved
            </span>
            <span className="text-slate-300 dark:text-slate-600 mx-1.5">·</span>
            <span className="font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
              {draftCount} {draftCount === 1 ? 'draft' : 'drafts'}
            </span>
          </div>
        </div>
      </div>

      {/* Generator Studio Card */}
      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/70 to-violet-50/50 dark:from-blue-500/15 dark:via-indigo-500/10 dark:to-violet-500/10 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              1. Generate Individual Monthly Report
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Reports are generated independently per student. Cancelled lessons and uncompleted class drafts are excluded automatically.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {students.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add a student profile first to generate monthly academic progress reports.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-5">
                  <label
                    htmlFor="monthly-student-select"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5"
                  >
                    Student *
                  </label>
                  <select
                    id="monthly-student-select"
                    value={selectedStudentId}
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setGenError(null);
                    }}
                    className={INPUT_CLASS}
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.subjects.join(' & ')})
                        {s.status === StudentStatus.ARCHIVED ? ' — Archived' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label
                    htmlFor="monthly-month-select"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5"
                  >
                    Reporting Month *
                  </label>
                  <select
                    id="monthly-month-select"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(Number(e.target.value));
                      setGenError(null);
                    }}
                    className={INPUT_CLASS}
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="monthly-year-select"
                    className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5"
                  >
                    Year *
                  </label>
                  <select
                    id="monthly-year-select"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(Number(e.target.value));
                      setGenError(null);
                    }}
                    className={INPUT_CLASS}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    disabled={generating || !selectedStudent}
                    onClick={() =>
                      selectedStudent && void runGenerate(selectedStudent, selectedYear, selectedMonth)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:via-indigo-700 hover:to-violet-700 rounded-xl shadow-xs transition-all whitespace-nowrap disabled:opacity-60"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick-jump chips for months that actually have records for this student */}
              {studentActiveMonths.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Months with records for {selectedStudent?.fullName}:
                  </span>
                  {studentActiveMonths.slice(0, 6).map((m) => {
                    const isSelected = m.year === selectedYear && m.month === selectedMonth;
                    return (
                      <button
                        key={m.monthKey}
                        type="button"
                        onClick={() => {
                          setSelectedYear(m.year);
                          setSelectedMonth(m.month);
                          setGenError(null);
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 dark:bg-[#0E1629] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {m.label} ({m.completedClassesCount}c · {m.homeworkCount}hw)
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Compiled Source Preview Strip */}
              {compiledPreview && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0E1629] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Compiled Records Preview · {compiledPreview.student.fullName} ·{' '}
                      {compiledPreview.reportingMonthLabel}
                    </p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Subjects: {compiledPreview.subjectsCoveredText}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-white dark:bg-[#131D33] border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Completed Classes
                      </p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {compiledPreview.stats.completedClassesCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-[#131D33] border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Approved AI Class Reports
                      </p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {compiledPreview.stats.approvedAiReportsCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-[#131D33] border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Instruction Time
                      </p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {compiledPreview.stats.totalInstructionMinutes} min
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white dark:bg-[#131D33] border border-slate-200/80 dark:border-slate-800">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Homework Records
                      </p>
                      <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                        {compiledPreview.stats.homeworkCompletedCount}/
                        {compiledPreview.stats.homeworkAssignedCount} done
                      </p>
                    </div>
                  </div>

                  {(compiledPreview.stats.excludedCancelledPlansCount > 0 ||
                    compiledPreview.stats.excludedDraftOrLiveClassesCount > 0) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Excluded automatically:{' '}
                      {compiledPreview.stats.excludedDraftOrLiveClassesCount} incomplete/in-progress class{' '}
                      {compiledPreview.stats.excludedDraftOrLiveClassesCount === 1 ? 'record' : 'records'} and{' '}
                      {compiledPreview.stats.excludedCancelledPlansCount} cancelled lesson{' '}
                      {compiledPreview.stats.excludedCancelledPlansCount === 1 ? 'plan' : 'plans'}.
                    </p>
                  )}

                  {compiledPreview.stats.completedClassesCount === 0 && (
                    <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        No completed classes were documented for{' '}
                        <strong>{compiledPreview.student.fullName}</strong> in{' '}
                        <strong>{compiledPreview.reportingMonthLabel}</strong>.
                        {compiledPreview.stats.homeworkAssignedCount > 0
                          ? ` ${compiledPreview.stats.homeworkAssignedCount} homework record(s) exist for this month and can still be summarized factually.`
                          : ' You can pick a month with documented classes above or generate a factual no-classes summary.'}
                      </span>
                    </div>
                  )}

                  {existingForSelection && (
                    <div className="p-3.5 rounded-lg bg-blue-50 dark:bg-blue-500/15 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-800 dark:text-blue-200 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        A{' '}
                        <strong>
                          {existingForSelection.status === MonthlyReportStatus.APPROVED
                            ? 'saved approved'
                            : 'saved draft'}
                        </strong>{' '}
                        report already exists for {compiledPreview.student.fullName} (
                        {compiledPreview.reportingMonthLabel}).
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenSaved(existingForSelection)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        {existingForSelection.status === MonthlyReportStatus.APPROVED
                          ? 'Open Approved Report'
                          : 'Resume Editing Draft'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {generating && (
                <div className="p-5 rounded-xl bg-violet-50/70 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-violet-600 dark:text-violet-400 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Synthesizing {selectedStudent?.fullName}&apos;s monthly academic records...
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Evaluating completed classes, subject performance, and homework evidence across {compiledPreview?.reportingMonthLabel}.
                    </p>
                  </div>
                </div>
              )}

              {genError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Report History Section */}
      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              2. Monthly Report History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filter by student, month, year, or approval status to edit drafts or view and download approved PDF reports.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {filteredHistory.length} of {monthlyReports.length}{' '}
            {monthlyReports.length === 1 ? 'report' : 'reports'}
          </span>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0E1629]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student, month, topics..."
                aria-label="Search monthly reports"
                className={`${FILTER_INPUT_CLASS} pl-9`}
              />
            </div>

            <div className="lg:col-span-3">
              <select
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
                aria-label="Filter by student"
                className={FILTER_INPUT_CLASS}
              >
                <option value="all">All students</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                aria-label="Filter by month"
                className={FILTER_INPUT_CLASS}
              >
                <option value="all">All months</option>
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={String(idx + 1)}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                aria-label="Filter by year"
                className={FILTER_INPUT_CLASS}
              >
                <option value="all">Year</option>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2 flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as 'all' | MonthlyReportStatus)
                }
                aria-label="Filter by status"
                className={FILTER_INPUT_CLASS}
              >
                <option value="all">All statuses</option>
                <option value={MonthlyReportStatus.DRAFT}>Drafts</option>
                <option value={MonthlyReportStatus.APPROVED}>Approved</option>
              </select>

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setFilterStudentId('all');
                    setFilterMonth('all');
                    setFilterYear('all');
                    setFilterStatus('all');
                  }}
                  title="Clear filters"
                  className="p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg shrink-0"
                >
                  <FilterX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="m-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
          >
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Award className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {monthlyReports.length === 0
                ? 'No monthly progress reports generated yet'
                : 'No monthly reports match your current filters'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a student, month, and year above to generate your first monthly academic progress report.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredHistory.map((rep) => {
              const isApproved = rep.status === MonthlyReportStatus.APPROVED;
              const approvedDate = rep.approvedAt?.toDate
                ? rep.approvedAt.toDate().toLocaleDateString()
                : undefined;

              return (
                <div
                  key={rep.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                        rep.studentName
                      )} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                    >
                      {getStudentInitials(rep.studentName)}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenSaved(rep)}
                          className="text-left text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {rep.studentName} · {rep.reportingMonthLabel}
                        </button>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getMonthlyReportStatusClass(
                            rep.status
                          )}`}
                        >
                          {isApproved ? 'Approved' : 'Draft'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {rep.subjectsCovered}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          {rep.completedClassesCount}{' '}
                          {rep.completedClassesCount === 1 ? 'class' : 'classes'}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Clock className="w-3.5 h-3.5" />
                          {rep.totalInstructionMinutes} min
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <FileCheck2 className="w-3.5 h-3.5" />
                          {rep.homeworkCompletedCount}/{rep.homeworkAssignedCount} homework
                        </span>
                        {approvedDate && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved {approvedDate}
                          </span>
                        )}
                      </div>

                      {rep.conclusion?.trim() && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 pt-0.5">
                          {rep.conclusion}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenSaved(rep)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {isApproved ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          View Report
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Draft
                        </>
                      )}
                    </button>

                    {isApproved && (
                      <>
                        <button
                          type="button"
                          onClick={() => downloadMonthlyReportPdf(rep, teacherName)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintSaved(rep)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rep)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
                      aria-label={`Delete ${rep.studentName} ${rep.reportingMonthLabel} report`}
                    >
                      <Trash2 className="w-4 h-4" />
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
        title="Delete monthly progress report?"
        description={`Delete the monthly academic progress report for ${deleteTarget?.studentName ?? ''} (${deleteTarget?.reportingMonthLabel ?? ''})? Original class records and homework remain untouched.`}
        confirmLabel="Delete Report"
        busy={deleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
