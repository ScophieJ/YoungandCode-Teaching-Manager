import {
  ClassReportStatus,
  formatHomeworkStatusLabel,
  getEffectiveHomeworkStatus,
  LessonPlanStatus,
  localTodayIso,
  Subject,
  type ApprovedAiReport,
  type ClassReport,
  type Homework,
  type LessonPlan,
  type Student,
} from '../types/teaching';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatMonthKey(year: number, month: number): string {
  const safeMonth = Math.min(12, Math.max(1, Math.round(month)));
  return `${year}-${String(safeMonth).padStart(2, '0')}`;
}

export function formatReportingMonthLabel(year: number, month: number): string {
  const name = MONTH_NAMES[Math.min(11, Math.max(0, Math.round(month) - 1))];
  return `${name} ${year}`;
}

export function formatStudentGradeAndAge(student: Student): string {
  const parts: string[] = [];
  if (student.grade?.trim()) parts.push(student.grade.trim());
  if (student.age?.trim()) parts.push(`Age ${student.age.trim()}`);
  return parts.length > 0 ? parts.join(' · ') : 'Not recorded';
}

export interface CompiledCompletedClass {
  id: string;
  sessionDate: string;
  durationMinutes: number;
  subject: Subject;
  topic: string;
  understandingLevel: string;
  lessonPlanId?: string;
  plannedObjectives?: string;
  plannedOutcomes?: string;
  objectivesCovered: string;
  conceptsTaught: string;
  activitiesCompleted: string;
  practicalExercisesPerformed: string;
  classworkGiven: string;
  studentParticipation: string;
  understoodWell: string;
  struggledWith: string;
  challengesEncountered: string;
  homeworkAssigned: string;
  teacherObservations: string;
  recommendationsNextFocus: string;
  notes: string;
  progressNotes: string;
  approvedAiReport?: {
    id: string;
    learningObjectivesCovered: string;
    conceptsTaught: string;
    activitiesAndExercisesCompleted: string;
    studentParticipation: string;
    demonstratedUnderstanding: string;
    areasRequiringImprovement: string;
    challengesEncountered: string;
    homeworkAssigned: string;
    teacherObservations: string;
    recommendedNextSteps: string;
  };
}

export interface CompiledHomeworkRecord {
  id: string;
  subject: Subject;
  title: string;
  assignedDate: string;
  dueDate: string;
  submittedDate: string;
  effectiveStatus: string;
  statusLabel: string;
  score: string;
  feedback: string;
  areasForImprovement: string;
  studentWorkSummary: string;
}

export interface CompiledPlannedUncompletedLesson {
  id: string;
  subject: Subject;
  topic: string;
  scheduledDate: string;
  status: LessonPlanStatus;
  learningObjectives: string;
}

export interface CompiledMonthlyStudentPayload {
  student: {
    id: string;
    fullName: string;
    age: string;
    grade: string;
    gradeAndAge: string;
    school: string;
    subjects: Subject[];
    mathLevel: string;
    techLevel: string;
    learningGoals: string;
    teachingNotes: string;
  };
  monthKey: string;
  reportYear: number;
  reportMonth: number;
  reportingMonthLabel: string;
  subjectsCoveredList: Subject[];
  subjectsCoveredText: string;
  stats: {
    completedClassesCount: number;
    approvedAiReportsCount: number;
    totalInstructionMinutes: number;
    homeworkAssignedCount: number;
    homeworkCompletedCount: number;
    homeworkOutstandingCount: number;
    homeworkSubmittedOrReviewCount: number;
    homeworkOverdueCount: number;
    excludedCancelledPlansCount: number;
    excludedDraftOrLiveClassesCount: number;
    uncompletedPlannedLessonsCount: number;
  };
  completedClasses: CompiledCompletedClass[];
  standaloneApprovedAiReports: Array<{
    id: string;
    classReportId: string;
    sessionDate: string;
    subject: Subject;
    lessonTopic: string;
    dateAndDuration: string;
    learningObjectivesCovered: string;
    conceptsTaught: string;
    activitiesAndExercisesCompleted: string;
    studentParticipation: string;
    demonstratedUnderstanding: string;
    areasRequiringImprovement: string;
    challengesEncountered: string;
    homeworkAssigned: string;
    teacherObservations: string;
    recommendedNextSteps: string;
  }>;
  uncompletedPlannedLessons: CompiledPlannedUncompletedLesson[];
  homeworkRecords: CompiledHomeworkRecord[];
}

export interface CompileMonthlyInput {
  student: Student;
  year: number;
  month: number;
  classReports: ClassReport[];
  approvedAiReports: ApprovedAiReport[];
  lessonPlans: LessonPlan[];
  homework: Homework[];
  referenceDate?: string;
}

export function compileMonthlyStudentRecords({
  student,
  year,
  month,
  classReports,
  approvedAiReports,
  lessonPlans,
  homework,
  referenceDate = localTodayIso(),
}: CompileMonthlyInput): CompiledMonthlyStudentPayload {
  const monthKey = formatMonthKey(year, month);
  const reportingMonthLabel = formatReportingMonthLabel(year, month);

  const studentPlansInMonth = lessonPlans.filter(
    (p) => p.studentId === student.id && p.scheduledDate.startsWith(monthKey)
  );
  const excludedCancelledPlansCount = studentPlansInMonth.filter(
    (p) => p.status === LessonPlanStatus.CANCELLED
  ).length;
  const nonCancelledPlansInMonth = studentPlansInMonth.filter(
    (p) => p.status !== LessonPlanStatus.CANCELLED
  );
  const planById = new Map<string, LessonPlan>();
  for (const plan of lessonPlans) {
    if (plan.studentId === student.id && plan.status !== LessonPlanStatus.CANCELLED) {
      planById.set(plan.id, plan);
    }
  }

  const studentClassReportsInMonth = classReports.filter(
    (r) => r.studentId === student.id && r.sessionDate.startsWith(monthKey)
  );
  const excludedDraftOrLiveClassesCount = studentClassReportsInMonth.filter(
    (r) => r.status !== ClassReportStatus.COMPLETED
  ).length;

  // Deduplicate completed class reports by id just in case
  const seenClassIds = new Set<string>();
  const completedClassDocs = studentClassReportsInMonth
    .filter((r) => {
      if (r.status !== ClassReportStatus.COMPLETED) return false;
      if (seenClassIds.has(r.id)) return false;
      seenClassIds.add(r.id);
      return true;
    })
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  // Approved AI reports in the month (strictly tied to studentId and monthKey)
  const seenAiIds = new Set<string>();
  const monthAiReports = approvedAiReports
    .filter((a) => {
      if (a.studentId !== student.id) return false;
      if (!a.sessionDate.startsWith(monthKey)) return false;
      if (seenAiIds.has(a.id)) return false;
      seenAiIds.add(a.id);
      return true;
    })
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));

  const aiReportByClassId = new Map<string, ApprovedAiReport>();
  for (const aiRep of monthAiReports) {
    if (!aiReportByClassId.has(aiRep.classReportId)) {
      aiReportByClassId.set(aiRep.classReportId, aiRep);
    }
  }

  const linkedPlanIds = new Set<string>();
  const matchedAiIds = new Set<string>();

  const completedClasses: CompiledCompletedClass[] = completedClassDocs.map((rep) => {
    const linkedPlan = rep.lessonPlanId ? planById.get(rep.lessonPlanId) : undefined;
    if (rep.lessonPlanId) linkedPlanIds.add(rep.lessonPlanId);
    const linkedAi = aiReportByClassId.get(rep.id);
    if (linkedAi) matchedAiIds.add(linkedAi.id);

    return {
      id: rep.id,
      sessionDate: rep.sessionDate,
      durationMinutes: Number.isFinite(rep.durationMinutes) ? rep.durationMinutes : 0,
      subject: rep.subject,
      topic: rep.topic,
      understandingLevel: rep.understandingLevel,
      lessonPlanId: rep.lessonPlanId,
      plannedObjectives: linkedPlan?.learningObjectives ?? '',
      plannedOutcomes: linkedPlan?.expectedOutcomes ?? '',
      objectivesCovered: rep.objectivesCovered ?? '',
      conceptsTaught: rep.conceptsTaught ?? '',
      activitiesCompleted: rep.activitiesCompleted ?? '',
      practicalExercisesPerformed: rep.practicalExercisesPerformed ?? '',
      classworkGiven: rep.classworkGiven ?? '',
      studentParticipation: rep.studentParticipation ?? '',
      understoodWell: rep.understoodWell ?? '',
      struggledWith: rep.struggledWith ?? '',
      challengesEncountered: rep.challengesEncountered ?? '',
      homeworkAssigned: rep.homeworkAssigned ?? '',
      teacherObservations: rep.teacherObservations ?? '',
      recommendationsNextFocus: rep.recommendationsNextFocus ?? '',
      notes: rep.notes ?? '',
      progressNotes: rep.progressNotes ?? '',
      ...(linkedAi
        ? {
            approvedAiReport: {
              id: linkedAi.id,
              learningObjectivesCovered: linkedAi.learningObjectivesCovered,
              conceptsTaught: linkedAi.conceptsTaught,
              activitiesAndExercisesCompleted: linkedAi.activitiesAndExercisesCompleted,
              studentParticipation: linkedAi.studentParticipation,
              demonstratedUnderstanding: linkedAi.demonstratedUnderstanding,
              areasRequiringImprovement: linkedAi.areasRequiringImprovement,
              challengesEncountered: linkedAi.challengesEncountered,
              homeworkAssigned: linkedAi.homeworkAssigned,
              teacherObservations: linkedAi.teacherObservations,
              recommendedNextSteps: linkedAi.recommendedNextSteps,
            },
          }
        : {}),
    };
  });

  // Only include approved AI reports whose parent classReport wasn't already paired above
  const standaloneApprovedAiReports = monthAiReports
    .filter((aiRep) => !matchedAiIds.has(aiRep.id))
    .map((aiRep) => ({
      id: aiRep.id,
      classReportId: aiRep.classReportId,
      sessionDate: aiRep.sessionDate,
      subject: aiRep.subject,
      lessonTopic: aiRep.lessonTopic,
      dateAndDuration: aiRep.dateAndDuration,
      learningObjectivesCovered: aiRep.learningObjectivesCovered,
      conceptsTaught: aiRep.conceptsTaught,
      activitiesAndExercisesCompleted: aiRep.activitiesAndExercisesCompleted,
      studentParticipation: aiRep.studentParticipation,
      demonstratedUnderstanding: aiRep.demonstratedUnderstanding,
      areasRequiringImprovement: aiRep.areasRequiringImprovement,
      challengesEncountered: aiRep.challengesEncountered,
      homeworkAssigned: aiRep.homeworkAssigned,
      teacherObservations: aiRep.teacherObservations,
      recommendedNextSteps: aiRep.recommendedNextSteps,
    }));

  // Non-cancelled lesson plans that were not already documented as completed classes
  const uncompletedPlannedLessons: CompiledPlannedUncompletedLesson[] = nonCancelledPlansInMonth
    .filter((p) => !linkedPlanIds.has(p.id) && p.status !== LessonPlanStatus.COMPLETED)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .map((p) => ({
      id: p.id,
      subject: p.subject,
      topic: p.topic,
      scheduledDate: p.scheduledDate,
      status: p.status,
      learningObjectives: p.learningObjectives,
    }));

  // Homework records belonging strictly to this student and active/assigned/due/submitted in this month
  const seenHwIds = new Set<string>();
  const monthHomework = homework
    .filter((h) => {
      if (h.studentId !== student.id) return false;
      const inMonth =
        Boolean(h.assignedDate?.startsWith(monthKey)) ||
        h.dueDate.startsWith(monthKey) ||
        Boolean(h.submittedDate?.startsWith(monthKey));
      if (!inMonth) return false;
      if (seenHwIds.has(h.id)) return false;
      seenHwIds.add(h.id);
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let homeworkCompletedCount = 0;
  let homeworkSubmittedOrReviewCount = 0;
  let homeworkOverdueCount = 0;

  const homeworkRecords: CompiledHomeworkRecord[] = monthHomework.map((h) => {
    const eff = getEffectiveHomeworkStatus(h, referenceDate);
    if (eff === 'completed') homeworkCompletedCount += 1;
    if (eff === 'submitted' || eff === 'under_review') homeworkSubmittedOrReviewCount += 1;
    if (eff === 'overdue') homeworkOverdueCount += 1;

    return {
      id: h.id,
      subject: h.subject,
      title: h.title,
      assignedDate: h.assignedDate ?? '',
      dueDate: h.dueDate,
      submittedDate: h.submittedDate ?? '',
      effectiveStatus: eff,
      statusLabel: formatHomeworkStatusLabel(eff),
      score: h.score ?? '',
      feedback: h.feedback ?? '',
      areasForImprovement: h.areasForImprovement ?? '',
      studentWorkSummary: h.studentWorkSummary ?? '',
    };
  });

  const homeworkAssignedCount = homeworkRecords.length;
  const homeworkOutstandingCount = Math.max(0, homeworkAssignedCount - homeworkCompletedCount);

  // Ordered subjects relevant to this student's profile and recorded work
  const subjectSet = new Set<Subject>();
  for (const s of student.subjects) subjectSet.add(s);
  for (const c of completedClasses) subjectSet.add(c.subject);
  for (const a of standaloneApprovedAiReports) subjectSet.add(a.subject);
  for (const h of homeworkRecords) subjectSet.add(h.subject);

  const orderedSubjects: Subject[] = [];
  if (subjectSet.has(Subject.MATHEMATICS)) orderedSubjects.push(Subject.MATHEMATICS);
  if (subjectSet.has(Subject.TECHNOLOGY)) orderedSubjects.push(Subject.TECHNOLOGY);
  if (orderedSubjects.length === 0) orderedSubjects.push(Subject.TECHNOLOGY);

  const totalInstructionMinutes = completedClasses.reduce(
    (sum, c) => sum + (Number.isFinite(c.durationMinutes) ? c.durationMinutes : 0),
    0
  );

  return {
    student: {
      id: student.id,
      fullName: student.fullName,
      age: student.age ?? '',
      grade: student.grade ?? '',
      gradeAndAge: formatStudentGradeAndAge(student),
      school: student.school ?? '',
      subjects: student.subjects.length > 0 ? student.subjects : orderedSubjects,
      mathLevel: student.mathLevel ?? '',
      techLevel: student.techLevel ?? '',
      learningGoals: student.learningGoals ?? '',
      teachingNotes: student.teachingNotes ?? '',
    },
    monthKey,
    reportYear: year,
    reportMonth: month,
    reportingMonthLabel,
    subjectsCoveredList: orderedSubjects,
    subjectsCoveredText: orderedSubjects.join(', '),
    stats: {
      completedClassesCount: completedClasses.length,
      approvedAiReportsCount: monthAiReports.length,
      totalInstructionMinutes,
      homeworkAssignedCount,
      homeworkCompletedCount,
      homeworkOutstandingCount,
      homeworkSubmittedOrReviewCount,
      homeworkOverdueCount,
      excludedCancelledPlansCount,
      excludedDraftOrLiveClassesCount,
      uncompletedPlannedLessonsCount: uncompletedPlannedLessons.length,
    },
    completedClasses,
    standaloneApprovedAiReports,
    uncompletedPlannedLessons,
    homeworkRecords,
  };
}

export interface StudentMonthActivitySummary {
  monthKey: string;
  year: number;
  month: number;
  label: string;
  completedClassesCount: number;
  homeworkCount: number;
}

export function getStudentAvailableMonths(
  studentId: string,
  classReports: ClassReport[],
  approvedAiReports: ApprovedAiReport[],
  homework: Homework[]
): StudentMonthActivitySummary[] {
  const map = new Map<string, { classes: number; homework: number }>();

  const ensure = (mk: string) => {
    let entry = map.get(mk);
    if (!entry) {
      entry = { classes: 0, homework: 0 };
      map.set(mk, entry);
    }
    return entry;
  };

  for (const r of classReports) {
    if (r.studentId !== studentId || r.status !== ClassReportStatus.COMPLETED) continue;
    const mk = r.sessionDate.slice(0, 7);
    if (/^[0-9]{4}-[0-9]{2}$/.test(mk)) {
      ensure(mk).classes += 1;
    }
  }

  for (const a of approvedAiReports) {
    if (a.studentId !== studentId) continue;
    const mk = a.sessionDate.slice(0, 7);
    if (/^[0-9]{4}-[0-9]{2}$/.test(mk)) {
      ensure(mk);
    }
  }

  for (const h of homework) {
    if (h.studentId !== studentId) continue;
    const dates = [h.assignedDate, h.dueDate, h.submittedDate].filter(
      (d): d is string => Boolean(d && d.length >= 7)
    );
    const seenMk = new Set<string>();
    for (const d of dates) {
      const mk = d.slice(0, 7);
      if (/^[0-9]{4}-[0-9]{2}$/.test(mk) && !seenMk.has(mk)) {
        seenMk.add(mk);
        ensure(mk).homework += 1;
      }
    }
  }

  return Array.from(map.entries())
    .map(([monthKey, counts]) => {
      const [yStr, mStr] = monthKey.split('-');
      const year = Number(yStr);
      const month = Number(mStr);
      return {
        monthKey,
        year,
        month,
        label: formatReportingMonthLabel(year, month),
        completedClassesCount: counts.classes,
        homeworkCount: counts.homework,
      };
    })
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
