import { useEffect, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  formatHomeworkLinkKindLabel,
  getEffectiveHomeworkStatus,
  HomeworkLinkKind,
  HomeworkStatus,
  StudentStatus,
  Subject,
  type ClassReport,
  type Homework,
  type HomeworkLink,
  type LessonPlan,
  type Student,
} from '../types/teaching';
import {
  createHomework,
  sanitizeHttpUrl,
  todayIsoDate,
  updateHomework,
} from '../lib/firestoreService';
import { INPUT_CLASS } from '../lib/uiTokens';
import { HomeworkLinkListEditor } from './HomeworkLinkListEditor';

interface HomeworkFormModalProps {
  open: boolean;
  teacherId: string;
  students: Student[];
  lessonPlans: LessonPlan[];
  classReports: ClassReport[];
  editingItem: Homework | null;
  lockedStudent?: Student;
  onClose: () => void;
  onSaved?: (homeworkId: string) => void;
}

export function HomeworkFormModal({
  open,
  teacherId,
  students,
  lessonPlans,
  classReports,
  editingItem,
  lockedStudent,
  onClose,
  onSaved,
}: HomeworkFormModalProps) {
  const activeStudents = students.filter((s) => s.status === StudentStatus.ACTIVE);
  const selectableStudents = activeStudents.length > 0 ? activeStudents : students;

  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState<Subject>(Subject.MATHEMATICS);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questionsOrTasks, setQuestionsOrTasks] = useState('');
  const [assignedDate, setAssignedDate] = useState(todayIsoDate());
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [status, setStatus] = useState<HomeworkStatus>(HomeworkStatus.ASSIGNED);
  const [lessonPlanId, setLessonPlanId] = useState('');
  const [classReportId, setClassReportId] = useState('');
  const [supportingLinks, setSupportingLinks] = useState<HomeworkLink[]>([]);

  // Draft link inputs so unsaved typed links aren't accidentally dropped on form submit
  const [draftLinkTitle, setDraftLinkTitle] = useState('');
  const [draftLinkUrl, setDraftLinkUrl] = useState('');
  const [draftLinkKind, setDraftLinkKind] = useState<HomeworkLinkKind>(
    HomeworkLinkKind.GOOGLE_DOC
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDraftLinkTitle('');
    setDraftLinkUrl('');
    setDraftLinkKind(HomeworkLinkKind.GOOGLE_DOC);

    if (editingItem) {
      setStudentId(editingItem.studentId);
      setSubject(editingItem.subject);
      setTitle(editingItem.title);
      setInstructions(editingItem.instructions ?? '');
      setQuestionsOrTasks(editingItem.questionsOrTasks ?? '');
      setAssignedDate(editingItem.assignedDate || todayIsoDate());
      setDueDate(editingItem.dueDate);
      const effective = getEffectiveHomeworkStatus(editingItem);
      setStatus(effective as HomeworkStatus);
      setLessonPlanId(editingItem.lessonPlanId ?? '');
      setClassReportId(editingItem.classReportId ?? '');
      setSupportingLinks(editingItem.supportingLinks ?? []);
    } else {
      const initialStudent = lockedStudent ?? selectableStudents[0];
      setStudentId(initialStudent?.id ?? '');
      setSubject(initialStudent?.subjects[0] ?? Subject.MATHEMATICS);
      setTitle('');
      setInstructions('');
      setQuestionsOrTasks('');
      setAssignedDate(todayIsoDate());
      setDueDate(todayIsoDate());
      setStatus(HomeworkStatus.ASSIGNED);
      setLessonPlanId('');
      setClassReportId('');
      setSupportingLinks([]);
    }
  }, [open, editingItem, lockedStudent]);

  if (!open) return null;

  const selectedStudent = students.find((s) => s.id === studentId) ?? lockedStudent;
  const allowedSubjects =
    selectedStudent && selectedStudent.subjects.length > 0
      ? selectedStudent.subjects
      : [Subject.MATHEMATICS, Subject.TECHNOLOGY];

  const studentPlans = lessonPlans.filter((p) => p.studentId === studentId);
  const studentReports = classReports.filter((r) => r.studentId === studentId);

  const handleStudentChange = (nextStudentId: string) => {
    setStudentId(nextStudentId);
    const nextStudent = students.find((s) => s.id === nextStudentId);
    if (nextStudent && nextStudent.subjects.length > 0 && !nextStudent.subjects.includes(subject)) {
      setSubject(nextStudent.subjects[0]);
    }
    setLessonPlanId('');
    setClassReportId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const student = students.find((s) => s.id === studentId) ?? lockedStudent;
    if (!student) {
      setError('Please select a student.');
      return;
    }
    if (!title.trim()) {
      setError('Assignment title is required.');
      return;
    }
    if (!dueDate.trim()) {
      setError('Due date is required.');
      return;
    }

    let finalLinks = [...supportingLinks];
    if (draftLinkUrl.trim()) {
      const safeUrl = sanitizeHttpUrl(draftLinkUrl);
      if (!safeUrl || safeUrl.length < 8) {
        setError('Supporting link URL must start with https:// or http://');
        return;
      }
      if (finalLinks.length >= BLUEPRINT_LIMITS.homework.maxLinks) {
        setError(`Maximum of ${BLUEPRINT_LIMITS.homework.maxLinks} supporting links allowed.`);
        return;
      }
      finalLinks.push({
        title:
          draftLinkTitle.trim().slice(0, BLUEPRINT_LIMITS.homework.linkTitleMax) ||
          formatHomeworkLinkKindLabel(draftLinkKind),
        url: safeUrl,
        kind: draftLinkKind,
      });
    }

    setSaving(true);
    try {
      let savedId = editingItem?.id ?? '';
      if (editingItem) {
        await updateHomework(editingItem.id, {
          studentName: student.fullName,
          subject,
          title,
          instructions,
          questionsOrTasks,
          assignedDate,
          dueDate,
          status,
          supportingLinks: finalLinks,
          lessonPlanId,
          classReportId,
        });
      } else {
        savedId = await createHomework(teacherId, {
          studentId: student.id,
          studentName: student.fullName,
          subject,
          title,
          instructions,
          questionsOrTasks,
          assignedDate,
          dueDate,
          status,
          supportingLinks: finalLinks,
          lessonPlanId,
          classReportId,
        });
      }
      onSaved?.(savedId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save homework assignment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="homework-form-modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl my-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="homework-form-modal-title"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                {editingItem ? 'Edit Homework Assignment' : 'Assign New Homework'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Set instructions, questions, deadlines, and learning links.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          {/* Student & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Student *
              </label>
              <select
                required
                disabled={Boolean(editingItem) || Boolean(lockedStudent)}
                value={studentId}
                onChange={(e) => handleStudentChange(e.target.value)}
                className={`${INPUT_CLASS} disabled:opacity-60`}
              >
                {selectableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value as Subject)}
                className={INPUT_CLASS}
              >
                {allowedSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Assignment Title *
            </label>
            <input
              type="text"
              required
              maxLength={BLUEPRINT_LIMITS.homework.titleMax}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fractions Word Problems & Scratch Loop Mini-Project"
              className={INPUT_CLASS}
            />
          </div>

          {/* Dates & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date Assigned
              </label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${INPUT_CLASS} font-mono tabular-nums`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as HomeworkStatus)}
                className={INPUT_CLASS}
              >
                <option value={HomeworkStatus.ASSIGNED}>Assigned</option>
                <option value={HomeworkStatus.SUBMITTED}>Submitted</option>
                <option value={HomeworkStatus.UNDER_REVIEW}>Under Review</option>
                <option value={HomeworkStatus.COMPLETED}>Completed</option>
                <option value={HomeworkStatus.OVERDUE}>Overdue</option>
              </select>
            </div>
          </div>

          {/* Related Lesson Plan & Class Record */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Related Lesson Plan
              </label>
              <select
                value={lessonPlanId}
                onChange={(e) => setLessonPlanId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">None selected</option>
                {studentPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.scheduledDate} · {plan.topic} ({plan.subject})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Related Class Record
              </label>
              <select
                value={classReportId}
                onChange={(e) => setClassReportId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">None selected</option>
                {studentReports.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.sessionDate} · {rep.topic} ({rep.subject})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Instructions & Questions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Instructions
            </label>
            <textarea
              rows={3}
              maxLength={BLUEPRINT_LIMITS.homework.instructionsMax}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Explain what the student should do and how to submit their work..."
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Questions or Tasks
            </label>
            <textarea
              rows={4}
              maxLength={BLUEPRINT_LIMITS.homework.questionsOrTasksMax}
              value={questionsOrTasks}
              onChange={(e) => setQuestionsOrTasks(e.target.value)}
              placeholder="1. Solve problems 1–8&#10;2. Build a 3-sprite animation using repeat loops..."
              className={INPUT_CLASS}
            />
          </div>

          {/* Supporting Resources / Links */}
          <HomeworkLinkListEditor
            label="Supporting Resources & Links"
            helperText="Attach Google Docs, Miro boards, YouTube videos, worksheets, or reference links."
            links={supportingLinks}
            onChange={setSupportingLinks}
            draftTitle={draftLinkTitle}
            onDraftTitleChange={setDraftLinkTitle}
            draftUrl={draftLinkUrl}
            onDraftUrlChange={setDraftLinkUrl}
            draftKind={draftLinkKind}
            onDraftKindChange={setDraftLinkKind}
          />

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
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
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-xs transition-all disabled:opacity-60"
            >
              {saving
                ? 'Saving...'
                : editingItem
                  ? 'Save Changes'
                  : 'Assign Homework'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
