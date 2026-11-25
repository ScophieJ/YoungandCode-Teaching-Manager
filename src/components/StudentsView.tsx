import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Edit3,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ClassReportStatus,
  StudentStatus,
  Subject,
  type ClassReport,
  type Homework,
  type Student,
} from '../types/teaching';
import {
  deleteStudentRecord,
  updateStudent,
} from '../lib/firestoreService';
import {
  CARD_CLASS,
  FILTER_INPUT_CLASS,
  getStudentAvatarGradient,
  getStudentInitials,
  getSubjectBadgeClass,
} from '../lib/uiTokens';
import { ConfirmDialog } from './ConfirmDialog';
import { StudentFormModal } from './StudentFormModal';

interface StudentsViewProps {
  teacherId: string;
  students: Student[];
  classReports: ClassReport[];
  homework: Homework[];
  loading: boolean;
  onOpenProfile: (studentId: string) => void;
}

export function formatStudentAgeGrade(student: Student): string {
  const parts: string[] = [];
  if (student.age?.trim()) {
    parts.push(`Age ${student.age.trim()}`);
  }
  if (student.grade?.trim()) {
    parts.push(student.grade.trim());
  }
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  if (student.ageGroup?.trim()) {
    return student.ageGroup.trim();
  }
  return '—';
}

export function StudentsView({
  teacherId,
  students,
  classReports,
  loading,
  onOpenProfile,
}: StudentsViewProps) {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<'all' | Subject>('all');
  const [statusFilter, setStatusFilter] = useState<StudentStatus>(StudentStatus.ACTIVE);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = students.filter((s) => {
    if (s.status !== statusFilter) return false;
    if (subjectFilter !== 'all' && !s.subjects.includes(subjectFilter)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        s.fullName.toLowerCase().includes(q) ||
        (s.grade ?? '').toLowerCase().includes(q) ||
        (s.school ?? '').toLowerCase().includes(q) ||
        (s.guardianName ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setModalOpen(true);
  };

  const handleToggleArchive = async (student: Student) => {
    setActionError(null);
    const nextStatus =
      student.status === StudentStatus.ACTIVE
        ? StudentStatus.ARCHIVED
        : StudentStatus.ACTIVE;
    try {
      await updateStudent(student.id, { status: nextStatus });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update student status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteStudentRecord(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete student.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Student Management
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Manage student profiles, subjects, completed lessons, and learning records.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Student
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

      {/* Search & Filter Toolbar */}
      <div className={`${CARD_CLASS} p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3`}>
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students by name..."
            aria-label="Search students by name"
            className={`${FILTER_INPUT_CLASS} pl-9`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800">
            {(['all', Subject.MATHEMATICS, Subject.TECHNOLOGY] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSubjectFilter(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  subjectFilter === opt
                    ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt === 'all' ? 'All Subjects' : opt}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0E1629] rounded-xl border border-slate-200/60 dark:border-slate-800">
            {[StudentStatus.ACTIVE, StudentStatus.ARCHIVED].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#1B2847] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Students Table / Cards */}
      <div className={`${CARD_CLASS} overflow-hidden`}>
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {statusFilter === StudentStatus.ARCHIVED
                ? 'No archived students match your search or filter.'
                : 'No active students match your search or filter.'}
            </p>
            {statusFilter === StudentStatus.ACTIVE && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Student
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Clean Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3.5 px-5">Student</th>
                    <th className="py-3.5 px-4">Grade / Age</th>
                    <th className="py-3.5 px-4">Subjects</th>
                    <th className="py-3.5 px-4 text-right">Completed Lessons</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {filtered.map((student) => {
                    const completedCount = classReports.filter(
                      (r) =>
                        r.studentId === student.id &&
                        r.status === ClassReportStatus.COMPLETED
                    ).length;
                    const ageGradeText = formatStudentAgeGrade(student);

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                                student.fullName
                              )} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                            >
                              {getStudentInitials(student.fullName)}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => onOpenProfile(student.id)}
                                className="text-left font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              >
                                {student.fullName}
                              </button>
                              {student.school && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {student.school}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {ageGradeText}
                        </td>
                        <td className="py-3.5 px-4">
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
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                          {completedCount}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenProfile(student.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 rounded-lg transition-colors whitespace-nowrap"
                            >
                              View Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(student)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                              aria-label={`Edit ${student.fullName}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleArchive(student)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                              aria-label={
                                student.status === StudentStatus.ACTIVE
                                  ? `Archive ${student.fullName}`
                                  : `Restore ${student.fullName}`
                              }
                              title={
                                student.status === StudentStatus.ACTIVE
                                  ? 'Archive student'
                                  : 'Restore student'
                              }
                            >
                              {student.status === StudentStatus.ACTIVE ? (
                                <Archive className="w-3.5 h-3.5" />
                              ) : (
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(student)}
                              className="p-1.5 text-red-600 dark:text-red-400 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 rounded-lg transition-colors"
                              aria-label={`Delete ${student.fullName}`}
                              title="Delete student"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((student) => {
                const completedCount = classReports.filter(
                  (r) =>
                    r.studentId === student.id &&
                    r.status === ClassReportStatus.COMPLETED
                ).length;
                const ageGradeText = formatStudentAgeGrade(student);

                return (
                  <div key={student.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(student.id)}
                        className="text-left flex items-center gap-3 min-w-0"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getStudentAvatarGradient(
                            student.fullName
                          )} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                        >
                          {getStudentInitials(student.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-900 dark:text-white hover:text-blue-600 truncate">
                            {student.fullName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {ageGradeText}
                            {student.school ? ` · ${student.school}` : ''}
                          </p>
                        </div>
                      </button>
                      <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                        {completedCount} {completedCount === 1 ? 'lesson' : 'lessons'}
                      </span>
                    </div>

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

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenProfile(student.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(student)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-lg"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleArchive(student)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-lg"
                      >
                        {student.status === StudentStatus.ACTIVE ? 'Archive' : 'Restore'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(student)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-500/15 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <StudentFormModal
        open={modalOpen}
        teacherId={teacherId}
        student={editingStudent}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.fullName ?? 'student'}?`}
        description="This permanently removes the student profile from your workspace. Consider archiving if you want to retain past records."
        confirmLabel="Delete Student"
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
