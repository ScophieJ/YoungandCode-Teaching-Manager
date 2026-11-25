import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Edit3,
  Eye,
  FileCheck,
  FilterX,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  formatHomeworkStatusLabel,
  getEffectiveHomeworkStatus,
  HomeworkStatus,
  Subject,
  type CanonicalHomeworkStatus,
  type ClassReport,
  type Homework,
  type LessonPlan,
  type Student,
} from '../types/teaching';
import {
  deleteHomework,
  todayIsoDate,
  updateHomework,
} from '../lib/firestoreService';
import {
  CARD_CLASS,
  FILTER_INPUT_CLASS,
  getHomeworkStatusClass,
  getStudentAvatarGradient,
  getStudentInitials,
  getSubjectBadgeClass,
} from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';
import { HomeworkDetailModal } from './HomeworkDetailModal';
import { HomeworkFormModal } from './HomeworkFormModal';
import { HomeworkLinkBadges } from './HomeworkLinkListEditor';

export type HomeworkDueDateFilter =
  | 'all'
  | 'overdue'
  | 'today'
  | 'next_7_days'
  | 'specific';

interface HomeworkViewProps {
  teacherId: string;
  students: Student[];
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  homework: Homework[];
  loading: boolean;
  initialHomeworkId?: string | null;
  onClearInitialHomeworkId?: () => void;
  initialStatusFilter?: 'all' | CanonicalHomeworkStatus;
  onClearInitialStatusFilter?: () => void;
  initialDueDatePreset?: HomeworkDueDateFilter;
  onClearInitialDueDatePreset?: () => void;
  onOpenStudent?: (studentId: string) => void;
}

function addDaysIso(baseDate: string, days: number): string {
  const [y, m, d] = baseDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export function HomeworkView({
  teacherId,
  students,
  lessonPlans,
  classReports,
  homework,
  loading,
  initialHomeworkId,
  onClearInitialHomeworkId,
  initialStatusFilter,
  onClearInitialStatusFilter,
  initialDueDatePreset,
  onClearInitialDueDatePreset,
  onOpenStudent,
}: HomeworkViewProps) {
  const today = todayIsoDate();
  const sevenDaysAhead = addDaysIso(today, 7);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CanonicalHomeworkStatus>('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | Subject>('all');
  const [dueDatePreset, setDueDatePreset] = useState<HomeworkDueDateFilter>('all');
  const [specificDueDate, setSpecificDueDate] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Homework | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Homework | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (initialHomeworkId) {
      setDetailItemId(initialHomeworkId);
      onClearInitialHomeworkId?.();
    }
  }, [initialHomeworkId, onClearInitialHomeworkId]);

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
      onClearInitialStatusFilter?.();
    }
  }, [initialStatusFilter, onClearInitialStatusFilter]);

  useEffect(() => {
    if (initialDueDatePreset) {
      setDueDatePreset(initialDueDatePreset);
      onClearInitialDueDatePreset?.();
    }
  }, [initialDueDatePreset, onClearInitialDueDatePreset]);

  const detailItem = detailItemId
    ? homework.find((h) => h.id === detailItemId) ?? null
    : null;

  // Live summary counts
  const totalCount = homework.length;
  const assignedCount = homework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'assigned'
  ).length;
  const submittedReviewCount = homework.filter((h) => {
    const st = getEffectiveHomeworkStatus(h, today);
    return st === 'submitted' || st === 'under_review';
  }).length;
  const completedCount = homework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'completed'
  ).length;
  const overdueCount = homework.filter(
    (h) => getEffectiveHomeworkStatus(h, today) === 'overdue'
  ).length;

  const filtered = homework.filter((item) => {
    const effectiveStatus = getEffectiveHomeworkStatus(item, today);
    if (statusFilter !== 'all' && effectiveStatus !== statusFilter) return false;
    if (studentFilter !== 'all' && item.studentId !== studentFilter) return false;
    if (subjectFilter !== 'all' && item.subject !== subjectFilter) return false;

    if (dueDatePreset === 'overdue') {
      if (effectiveStatus !== 'overdue') return false;
    } else if (dueDatePreset === 'today') {
      if (item.dueDate !== today) return false;
    } else if (dueDatePreset === 'next_7_days') {
      if (item.dueDate < today || item.dueDate > sevenDaysAhead) return false;
    } else if (dueDatePreset === 'specific' && specificDueDate) {
      if (item.dueDate !== specificDueDate) return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matches =
        item.title.toLowerCase().includes(q) ||
        item.studentName.toLowerCase().includes(q) ||
        (item.instructions ?? '').toLowerCase().includes(q) ||
        (item.questionsOrTasks ?? '').toLowerCase().includes(q) ||
        (item.feedback ?? '').toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  const hasActiveFilters =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    studentFilter !== 'all' ||
    subjectFilter !== 'all' ||
    dueDatePreset !== 'all' ||
    specificDueDate !== '';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setStudentFilter('all');
    setSubjectFilter('all');
    setDueDatePreset('all');
    setSpecificDueDate('');
  };

  const handleQuickStatusChange = async (
    item: Homework,
    nextStatus: HomeworkStatus
  ) => {
    setActionError(null);
    try {
      const payload: { status: HomeworkStatus; submittedDate?: string } = {
        status: nextStatus,
      };
      if (
        (nextStatus === HomeworkStatus.SUBMITTED ||
          nextStatus === HomeworkStatus.UNDER_REVIEW ||
          nextStatus === HomeworkStatus.COMPLETED) &&
        !item.submittedDate
      ) {
        payload.submittedDate = todayIsoDate();
      }
      await updateHomework(item.id, payload);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update homework status.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      const deletedId = deleteTarget.id;
      await deleteHomework(deletedId);
      setDeleteTarget(null);
      if (detailItemId === deletedId) {
        setDetailItemId(null);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete homework assignment.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const renderStatusBadge = (status: CanonicalHomeworkStatus) => {
    const badgeClass = getHomeworkStatusClass(status);
    const label = formatHomeworkStatusLabel(status);
    if (status === 'overdue') {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}
        >
          <AlertTriangle className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (status === 'submitted') {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}
        >
          <FileCheck className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (status === 'under_review') {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}
        >
          <Eye className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}
        >
          <CheckCircle2 className="w-3 h-3" />
          {label}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badgeClass}`}
      >
        <Clock className="w-3 h-3" />
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-orange-500/20">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Homework Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Assign practice tasks, attach learning links, track due dates, and assess student submissions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setFormOpen(true);
          }}
          disabled={students.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 self-start sm:self-auto disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Assign Homework
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
        >
          {actionError}
        </div>
      )}

      {/* Summary KPI Cards (clickable quick-filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'all'
              ? 'bg-white dark:bg-[#131D33] border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-500/15'
              : 'bg-white dark:bg-[#131D33] border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {totalCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('assigned')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'assigned'
              ? 'bg-white dark:bg-[#131D33] border-blue-400 dark:border-blue-500/60 ring-2 ring-blue-500/15'
              : 'bg-white dark:bg-[#131D33] border-slate-200/90 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/40'
          }`}
        >
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Assigned</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {assignedCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('submitted')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'submitted' || statusFilter === 'under_review'
              ? 'bg-white dark:bg-[#131D33] border-violet-400 dark:border-violet-500/60 ring-2 ring-violet-500/15'
              : 'bg-white dark:bg-[#131D33] border-slate-200/90 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40'
          }`}
        >
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
            Submitted / Review
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {submittedReviewCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('completed')}
          className={`text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'completed'
              ? 'bg-white dark:bg-[#131D33] border-emerald-400 dark:border-emerald-500/60 ring-2 ring-emerald-500/15'
              : 'bg-white dark:bg-[#131D33] border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40'
          }`}
        >
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Completed
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {completedCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('overdue')}
          className={`col-span-2 sm:col-span-1 text-left p-4 rounded-2xl border transition-all ${
            statusFilter === 'overdue'
              ? 'bg-red-50/60 dark:bg-red-950/30 border-red-400 dark:border-red-500/60 ring-2 ring-red-500/15'
              : overdueCount > 0
                ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 hover:border-red-300'
                : 'bg-white dark:bg-[#131D33] border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <p className="text-xs font-medium text-red-600 dark:text-red-400">Overdue</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-300 mt-1">
            {overdueCount}
          </p>
        </button>
      </div>

      {/* Search & Filters */}
      <div className={`${CARD_CLASS} p-4 space-y-3`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, student, instructions..."
              aria-label="Search homework assignments"
              className={`${FILTER_INPUT_CLASS} pl-9`}
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              aria-label="Filter homework by student"
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All Students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value as 'all' | Subject)}
              aria-label="Filter homework by subject"
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All Subjects</option>
              <option value={Subject.MATHEMATICS}>Mathematics</option>
              <option value={Subject.TECHNOLOGY}>Technology</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <select
              value={dueDatePreset}
              onChange={(e) => {
                const next = e.target.value as HomeworkDueDateFilter;
                setDueDatePreset(next);
                if (next !== 'specific') {
                  setSpecificDueDate('');
                } else if (!specificDueDate) {
                  setSpecificDueDate(today);
                }
              }}
              aria-label="Filter homework by due date"
              className={FILTER_INPUT_CLASS}
            >
              <option value="all">All Due Dates</option>
              <option value="overdue">Past Due (Overdue)</option>
              <option value="today">Due Today</option>
              <option value="next_7_days">Due Next 7 Days</option>
              <option value="specific">Specific Due Date</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800">
            {(
              [
                { value: 'all', label: 'All Statuses' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'submitted', label: 'Submitted' },
                { value: 'under_review', label: 'Under Review' },
                { value: 'completed', label: 'Completed' },
                { value: 'overdue', label: 'Overdue' },
              ] as Array<{ value: 'all' | CanonicalHomeworkStatus; label: string }>
            ).map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => setStatusFilter(st.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  statusFilter === st.value
                    ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dueDatePreset === 'specific' && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={specificDueDate}
                  onChange={(e) => setSpecificDueDate(e.target.value)}
                  aria-label="Specific due date"
                  className={`${FILTER_INPUT_CLASS} w-auto font-mono tabular-nums`}
                />
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Homework List */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
            <div className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {homework.length === 0
                ? 'No homework assignments created yet.'
                : 'No homework assignments match your current filters.'}
            </p>
            <div className="flex items-center justify-center gap-2.5">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  Reset Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setFormOpen(true);
                }}
                disabled={students.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Assign Homework
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((item) => {
              const effectiveStatus = getEffectiveHomeworkStatus(item, today);
              const linkedPlan = item.lessonPlanId
                ? lessonPlans.find((p) => p.id === item.lessonPlanId)
                : undefined;
              const linkedReport = item.classReportId
                ? classReports.find((r) => r.id === item.classReportId)
                : undefined;

              return (
                <div
                  key={item.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0 flex-1 flex items-start gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                        item.studentName
                      )} text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      {getStudentInitials(item.studentName)}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailItemId(item.id)}
                          className="text-left text-base font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {item.title}
                        </button>
                        {renderStatusBadge(effectiveStatus)}
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

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {onOpenStudent ? (
                          <button
                            type="button"
                            onClick={() => onOpenStudent(item.studentId)}
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
                      </div>

                      {(linkedPlan || linkedReport) && (
                        <div className="flex flex-wrap gap-1.5">
                          {linkedPlan && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-violet-50 text-violet-700 border border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30">
                              <CalendarClock className="w-3 h-3" />
                              Plan: {linkedPlan.topic}
                            </span>
                          )}
                          {linkedReport && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-teal-50 text-teal-700 border border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30">
                              <ClipboardCheck className="w-3 h-3" />
                              Class: {linkedReport.topic}
                            </span>
                          )}
                        </div>
                      )}

                      {(item.instructions?.trim() || item.questionsOrTasks?.trim()) && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 whitespace-pre-wrap">
                          {item.instructions?.trim() || item.questionsOrTasks?.trim()}
                        </p>
                      )}

                      {item.supportingLinks && item.supportingLinks.length > 0 && (
                        <HomeworkLinkBadges links={item.supportingLinks} compact />
                      )}

                      {item.feedback?.trim() && (
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 line-clamp-1">
                          Teacher feedback: {item.feedback}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
                    <select
                      value={effectiveStatus}
                      onChange={(e) =>
                        void handleQuickStatusChange(
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
                      onClick={() => setDetailItemId(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200/70 dark:border-blue-500/30 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      Open &amp; Assess
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item);
                        setFormOpen(true);
                      }}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      aria-label={`Edit ${item.title}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg transition-colors"
                      aria-label={`Delete ${item.title}`}
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

      <HomeworkFormModal
        open={formOpen}
        teacherId={teacherId}
        students={students}
        lessonPlans={lessonPlans}
        classReports={classReports}
        editingItem={editingItem}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
      />

      <HomeworkDetailModal
        item={detailItem}
        lessonPlans={lessonPlans}
        classReports={classReports}
        onClose={() => setDetailItemId(null)}
        onEditAssignment={(item) => {
          setEditingItem(item);
          setFormOpen(true);
        }}
        onDeleteRequest={(item) => setDeleteTarget(item)}
        onOpenStudent={onOpenStudent}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete homework assignment?"
        description={`Remove "${deleteTarget?.title ?? ''}" for ${deleteTarget?.studentName ?? ''}? This cannot be undone.`}
        confirmLabel="Delete Homework"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
