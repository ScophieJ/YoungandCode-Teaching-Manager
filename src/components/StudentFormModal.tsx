import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  Subject,
  type Student,
} from '../types/teaching';
import { createStudent, updateStudent } from '../lib/firestoreService';
import { INPUT_CLASS } from '../lib/uiTokens';

interface StudentFormModalProps {
  open: boolean;
  teacherId: string;
  student: Student | null;
  onClose: () => void;
}

interface StudentFormState {
  fullName: string;
  age: string;
  grade: string;
  school: string;
  subjects: Subject[];
  guardianName: string;
  teachingNotes: string;
}

const EMPTY_FORM: StudentFormState = {
  fullName: '',
  age: '',
  grade: '',
  school: '',
  subjects: [Subject.TECHNOLOGY],
  guardianName: '',
  teachingNotes: '',
};

export function StudentFormModal({
  open,
  teacherId,
  student,
  onClose,
}: StudentFormModalProps) {
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        fullName: student.fullName,
        age: student.age ?? '',
        grade: student.grade ?? '',
        school: student.school ?? '',
        subjects: [...student.subjects],
        guardianName: student.guardianName ?? '',
        teachingNotes: student.teachingNotes ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setFormError(null);
  }, [open, student]);

  if (!open) return null;

  const toggleSubject = (subject: Subject) => {
    setForm((prev) => {
      const exists = prev.subjects.includes(subject);
      const next = exists
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.fullName.trim()) {
      setFormError('Please enter the student full name.');
      return;
    }
    if (form.age.trim()) {
      const ageNum = Number(form.age.trim());
      if (Number.isNaN(ageNum) || ageNum < 1 || ageNum > 99) {
        setFormError('Age must be a valid number between 1 and 99.');
        return;
      }
    }
    if (form.subjects.length === 0) {
      setFormError('Select at least one subject (Mathematics or Technology).');
      return;
    }

    setSaving(true);
    try {
      if (student) {
        await updateStudent(student.id, {
          fullName: form.fullName,
          age: form.age,
          grade: form.grade,
          school: form.school,
          subjects: form.subjects,
          guardianName: form.guardianName,
          teachingNotes: form.teachingNotes,
        });
      } else {
        await createStudent(teacherId, {
          fullName: form.fullName,
          age: form.age,
          grade: form.grade,
          school: form.school,
          subjects: form.subjects,
          guardianName: form.guardianName,
          teachingNotes: form.teachingNotes,
        });
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-modal-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl my-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2
              id="student-modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              {student ? `Edit ${student.fullName}` : 'Add New Student'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label
              htmlFor="student-full-name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Full Name *
            </label>
            <input
              id="student-full-name"
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.student.fullNameMax}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g., Tahir Salawu"
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="student-age"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Age
              </label>
              <input
                id="student-age"
                type="number"
                min={1}
                max={99}
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="e.g., 10"
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label
                htmlFor="student-grade"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Grade
              </label>
              <input
                id="student-grade"
                type="text"
                maxLength={BLUEPRINT_LIMITS.student.gradeMax}
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g., Grade 5"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="student-school"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                School
              </label>
              <input
                id="student-school"
                type="text"
                maxLength={BLUEPRINT_LIMITS.student.schoolMax}
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
                placeholder="School name"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label
                htmlFor="student-guardian"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Parent / Guardian Name(s)
              </label>
              <input
                id="student-guardian"
                type="text"
                maxLength={BLUEPRINT_LIMITS.student.guardianNameMax}
                value={form.guardianName}
                onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
                placeholder="Parent or guardian name"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Subjects *
            </span>
            <div className="flex flex-wrap gap-3">
              {[Subject.MATHEMATICS, Subject.TECHNOLOGY].map((subj) => {
                const checked = form.subjects.includes(subj);
                const isMath = subj === Subject.MATHEMATICS;
                return (
                  <label
                    key={subj}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border cursor-pointer transition-colors ${
                      checked
                        ? isMath
                          ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-300'
                          : 'bg-teal-50 dark:bg-teal-500/15 border-teal-300 dark:border-teal-500/40 text-teal-800 dark:text-teal-300'
                        : 'bg-white dark:bg-[#0E1629] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubject(subj)}
                      className="accent-blue-600"
                    />
                    {subj}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="student-notes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Additional Teaching Notes
            </label>
            <textarea
              id="student-notes"
              rows={3}
              maxLength={BLUEPRINT_LIMITS.student.teachingNotesMax}
              value={form.teachingNotes}
              onChange={(e) => setForm({ ...form, teachingNotes: e.target.value })}
              placeholder="Learning preferences, pace, or helpful context..."
              className={INPUT_CLASS}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : student ? 'Save Changes' : 'Create Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
