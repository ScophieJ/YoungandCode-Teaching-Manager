import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  formatLessonStatusLabel,
  isScheduledLessonStatus,
  LessonPlanStatus,
  Subject,
  type LessonPlan,
  type Student,
} from '../types/teaching';
import {
  deleteLessonPlan,
  updateLessonPlan,
} from '../lib/firestoreService';
import {
  CARD_CLASS,
  FILTER_INPUT_CLASS,
  getLessonStatusClass,
  getStudentAvatarGradient,
  getStudentInitials,
  getSubjectBadgeClass,
} from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';
import {
  LessonPlanEditorView,
  type EditorMode,
} from './LessonPlanEditorView';

interface LessonPlansViewProps {
  teacherId: string;
  students: Student[];
  lessonPlans: LessonPlan[];
  loading: boolean;
  preselectedStudent?: Student | null;
  onClearPreselectedStudent?: () => void;
  initialPlanId?: string | null;
  onClearInitialPlanId?: () => void;
  onStartClassFromPlan: (plan: LessonPlan) => void;
}

type StatusFilter = 'all' | LessonPlanStatus;
type GroupingMode = 'grouped' | 'list';

interface EditorSession {
  mode: EditorMode;
  planId: string | null;
  sourcePlan: LessonPlan | null;
  preselectedStudent: Student | null;
  initialError?: string | null;
}

function normalizedStatusValue(status: LessonPlanStatus): LessonPlanStatus {
  return status === LessonPlanStatus.UPCOMING
    ? LessonPlanStatus.SCHEDULED
    : status;
}

export function LessonPlansView({
  teacherId,
  students,
  lessonPlans,
  loading,
  preselectedStudent,
  onClearPreselectedStudent,
  initialPlanId,
  onClearInitialPlanId,
  onStartClassFromPlan,
}: LessonPlansViewProps) {
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<'all' | Subject>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [grouping, setGrouping] = useState<GroupingMode>('grouped');

  const [editorSession, setEditorSession] = useState<EditorSession | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LessonPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (preselectedStudent) {
      setEditorSession({
        mode: 'create',
        planId: null,
        sourcePlan: null,
        preselectedStudent,
        initialError: null,
      });
      onClearPreselectedStudent?.();
    }
  }, [preselectedStudent, onClearPreselectedStudent]);

  useEffect(() => {
    if (initialPlanId) {
      const target = lessonPlans.find((p) => p.id === initialPlanId) ?? null;
      if (target) {
        setEditorSession({
          mode: 'view',
          planId: target.id,
          sourcePlan: target,
          preselectedStudent: null,
          initialError: null,
        });
      }
      onClearInitialPlanId?.();
    }
  }, [initialPlanId, lessonPlans, onClearInitialPlanId]);

  const filtered = lessonPlans.filter((p) => {
    if (studentFilter !== 'all' && p.studentId !== studentFilter) return false;
    if (subjectFilter !== 'all' && p.subject !== subjectFilter) return false;
    if (dateFilter && p.scheduledDate !== dateFilter) return false;
    if (statusFilter !== 'all') {
      if (statusFilter === LessonPlanStatus.SCHEDULED) {
        if (!isScheduledLessonStatus(p.status)) return false;
      } else if (p.status !== statusFilter) {
        return false;
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        p.topic.toLowerCase().includes(q) ||
        p.studentName.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.learningObjectives.toLowerCase().includes(q) ||
        p.activities.toLowerCase().includes(q) ||
        (p.expectedOutcomes ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    const dateCmp = b.scheduledDate.localeCompare(a.scheduledDate);
    if (dateCmp !== 0) return dateCmp;
    return a.studentName.localeCompare(b.studentName);
  });

  const groupedByStudent = (() => {
    const studentMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        student: Student | undefined;
        totalCount: number;
        dates: Array<{ date: string; plans: LessonPlan[] }>;
      }
    >();

    for (const plan of sortedFiltered) {
      let group = studentMap.get(plan.studentId);
      if (!group) {
        const linked = students.find((s) => s.id === plan.studentId);
        group = {
          studentId: plan.studentId,
          studentName: linked?.fullName ?? plan.studentName,
          student: linked,
          totalCount: 0,
          dates: [],
        };
        studentMap.set(plan.studentId, group);
      }
      group.totalCount += 1;

      let dateBucket = group.dates.find((d) => d.date === plan.scheduledDate);
      if (!dateBucket) {
        dateBucket = { date: plan.scheduledDate, plans: [] };
        group.dates.push(dateBucket);
      }
      dateBucket.plans.push(plan);
    }

    const groups = Array.from(studentMap.values());
    groups.sort((a, b) => a.studentName.localeCompare(b.studentName));
    for (const g of groups) {
      g.dates.sort((a, b) => b.date.localeCompare(a.date));
    }
    return groups;
  })();

  const openCreate = (forStudent?: Student | null) => {
    setActionError(null);
    setActionSuccess(null);
    setEditorSession({
      mode: 'create',
      planId: null,
      sourcePlan: null,
      preselectedStudent: forStudent ?? null,
      initialError: null,
    });
  };

  const openPlan = (plan: LessonPlan, mode: 'view' | 'edit') => {
    setActionError(null);
    setActionSuccess(null);
    setEditorSession({
      mode,
      planId: plan.id,
      sourcePlan: plan,
      preselectedStudent: null,
      initialError: null,
    });
  };

  const openDuplicate = (plan: LessonPlan) => {
    setActionError(null);
    setActionSuccess(null);
    setEditorSession({
      mode: 'duplicate',
      planId: null,
      sourcePlan: plan,
      preselectedStudent: null,
      initialError: null,
    });
  };

  const handleInlineStatusChange = async (
    plan: LessonPlan,
    nextStatus: LessonPlanStatus
  ) => {
    setActionError(null);
    setActionSuccess(null);

    if (
      nextStatus !== LessonPlanStatus.DRAFT &&
      nextStatus !== LessonPlanStatus.CANCELLED &&
      (!plan.learningObjectives.trim() || !plan.activities.trim())
    ) {
      setEditorSession({
        mode: 'edit',
        planId: plan.id,
        sourcePlan: plan,
        preselectedStudent: null,
        initialError:
          'Add Learning Objectives and Step-by-step Lesson Activities before marking this draft as scheduled or completed.',
      });
      return;
    }

    setUpdatingStatusId(plan.id);
    try {
      await updateLessonPlan(plan.id, { status: nextStatus });
      setActionSuccess(
        `"${plan.topic}" marked as ${formatLessonStatusLabel(nextStatus)}.`
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update lesson status.'
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const removedTopic = deleteTarget.topic;
      await deleteLessonPlan(deleteTarget.id);
      if (editorSession?.planId === deleteTarget.id) {
        setEditorSession(null);
      }
      setDeleteTarget(null);
      setActionSuccess(`Deleted "${removedTopic}".`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to delete lesson plan.'
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (editorSession) {
    const livePlan = editorSession.planId
      ? lessonPlans.find((p) => p.id === editorSession.planId) ?? editorSession.sourcePlan
      : editorSession.sourcePlan;

    return (
      <>
        <LessonPlanEditorView
          teacherId={teacherId}
          students={students}
          initialMode={editorSession.mode}
          plan={livePlan}
          preselectedStudent={editorSession.preselectedStudent}
          initialError={editorSession.initialError}
          onBack={() => setEditorSession(null)}
          onSaved={() => {
            setEditorSession(null);
            setActionSuccess(
              editorSession.mode === 'edit'
                ? 'Lesson plan changes saved.'
                : 'Lesson plan saved.'
            );
          }}
          onDuplicate={(p) => openDuplicate(p)}
          onDeleteRequest={(p) => setDeleteTarget(p)}
          onStartClassFromPlan={onStartClassFromPlan}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete lesson plan?"
          description={`Remove "${deleteTarget?.topic ?? ''}" for ${deleteTarget?.studentName ?? ''}? This cannot be undone.`}
          confirmLabel="Delete Plan"
          busy={deleting}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      </>
    );
  }

  const renderPlanRow = (plan: LessonPlan, showStudentName: boolean) => {
    const currentStatusVal = normalizedStatusValue(plan.status);
    return (
      <div
        key={plan.id}
        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openPlan(plan, 'view')}
              className="text-left text-base font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {plan.topic}
            </button>
            <span
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getLessonStatusClass(
                plan.status
              )}`}
            >
              {formatLessonStatusLabel(plan.status)}
            </span>
            <span
              className={`px-2 py-0.5 text-[11px] font-medium rounded-md border ${getSubjectBadgeClass(
                plan.subject
              )}`}
            >
              {plan.subject}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {showStudentName && (
              <>
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {plan.studentName}
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span className="font-mono tabular-nums">
              {plan.scheduledDate}
              {plan.scheduledTime ? ` at ${plan.scheduledTime}` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{plan.durationMinutes ?? 45} min</span>
          </p>

          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
            {plan.learningObjectives?.trim() ||
              'Draft — click Open or Edit to add learning objectives and activities.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isScheduledLessonStatus(plan.status) && (
            <button
              type="button"
              onClick={() => onStartClassFromPlan(plan)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Start Class
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <select
            aria-label={`Change status for ${plan.topic}`}
            value={currentStatusVal}
            disabled={updatingStatusId === plan.id}
            onChange={(e) =>
              void handleInlineStatusChange(plan, e.target.value as LessonPlanStatus)
            }
            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0E1629] border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 disabled:opacity-60"
          >
            <option value={LessonPlanStatus.DRAFT}>Draft</option>
            <option value={LessonPlanStatus.SCHEDULED}>Scheduled</option>
            <option value={LessonPlanStatus.COMPLETED}>Completed</option>
            <option value={LessonPlanStatus.CANCELLED}>Cancelled</option>
          </select>

          <button
            type="button"
            onClick={() => openPlan(plan, 'view')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            Open
          </button>

          <button
            type="button"
            onClick={() => openPlan(plan, 'edit')}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={`Edit ${plan.topic}`}
            title="Edit lesson plan"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => openDuplicate(plan)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={`Duplicate ${plan.topic}`}
            title="Duplicate lesson plan"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setDeleteTarget(plan)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 rounded-lg transition-colors"
            aria-label={`Delete ${plan.topic}`}
            title="Delete lesson plan"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-violet-600/20">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Lesson Planning
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Plan structured Mathematics and Technology lessons, save drafts, duplicate templates, and review lesson history.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openCreate(null)}
          disabled={students.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 self-start sm:self-auto disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          New Lesson Plan
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

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {actionSuccess}
          </span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-80"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className={`${CARD_CLASS} p-4 space-y-3`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic, student, or keyword..."
              aria-label="Search lesson plans"
              className={`${FILTER_INPUT_CLASS} pl-9`}
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              aria-label="Filter by student"
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

          <div className="md:col-span-3 flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by lesson date"
              className={`${FILTER_INPUT_CLASS} font-mono tabular-nums`}
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg shrink-0"
                aria-label="Clear date filter"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800">
              {(['all', Subject.MATHEMATICS, Subject.TECHNOLOGY] as const).map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setSubjectFilter(sub)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    subjectFilter === sub
                      ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sub === 'all' ? 'All Subjects' : sub}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-x-auto">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: LessonPlanStatus.DRAFT, label: 'Draft' },
                  { value: LessonPlanStatus.SCHEDULED, label: 'Scheduled' },
                  { value: LessonPlanStatus.COMPLETED, label: 'Completed' },
                  { value: LessonPlanStatus.CANCELLED, label: 'Cancelled' },
                ] as Array<{ value: StatusFilter; label: string }>
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
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setGrouping('grouped')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                grouping === 'grouped'
                  ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grouped by Student &amp; Date
            </button>
            <button
              type="button"
              onClick={() => setGrouping('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                grouping === 'list'
                  ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Timeline List
            </button>
          </div>
        </div>
      </div>

      {/* Lesson Plan History & Groups */}
      {loading ? (
        <div className={`${CARD_CLASS} p-6 space-y-3`}>
          <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        </div>
      ) : sortedFiltered.length === 0 ? (
        <div className={`${CARD_CLASS} p-10 text-center`}>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            {lessonPlans.length === 0
              ? 'No lesson plans created yet. Create your first structured lesson plan to get started.'
              : 'No lesson plans match your current search or filters.'}
          </p>
          <button
            type="button"
            onClick={() => openCreate(null)}
            disabled={students.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Lesson Plan
          </button>
        </div>
      ) : grouping === 'grouped' ? (
        <div className="space-y-6">
          {groupedByStudent.map((group) => (
            <section
              key={group.studentId}
              className={`${CARD_CLASS} overflow-hidden`}
            >
              <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1629] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                      group.studentName
                    )} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                  >
                    {getStudentInitials(group.studentName)}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      {group.studentName}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                      {group.student && (
                        <>
                          <span className="font-medium text-blue-700 dark:text-blue-300">
                            {group.student.subjects.join(' · ')}
                          </span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="font-mono tabular-nums">
                        {group.totalCount}{' '}
                        {group.totalCount === 1 ? 'lesson plan' : 'lesson plans'}
                      </span>
                    </p>
                  </div>
                </div>

                {group.student && (
                  <button
                    type="button"
                    onClick={() => openCreate(group.student)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Plan for {group.studentName.split(' ')[0]}
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {group.dates.map((bucket) => (
                  <div key={bucket.date}>
                    <div className="px-5 py-2 bg-slate-50/50 dark:bg-[#10192D] border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                        {bucket.date}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                        {bucket.plans.length} {bucket.plans.length === 1 ? 'plan' : 'plans'}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {bucket.plans.map((plan) => renderPlanRow(plan, false))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={`${CARD_CLASS} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800`}>
          {sortedFiltered.map((plan) => renderPlanRow(plan, true))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete lesson plan?"
        description={`Remove "${deleteTarget?.topic ?? ''}" for ${deleteTarget?.studentName ?? ''}? This cannot be undone.`}
        confirmLabel="Delete Plan"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
