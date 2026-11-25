import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BLUEPRINT_LIMITS,
  ClassReportStatus,
  HomeworkLinkKind,
  HomeworkStatus,
  IntegrationCategory,
  IntegrationConnectionStatus,
  IntegrationMethod,
  LessonPlanStatus,
  MonthlyReportStatus,
  ResourceType,
  StudentStatus,
  Subject,
  UnderstandingLevel,
  type AiReportDraft,
  type ApprovedAiReport,
  type ClassReport,
  type Homework,
  type HomeworkLink,
  type IntegrationAccentColor,
  type LessonPlan,
  type MonthlyReport,
  type MonthlyReportDraft,
  type MonthlySubjectAssessment,
  type Student,
  type StudentResource,
  type TeacherIntegration,
} from '../types/teaching';

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sanitizeHttpUrl(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed.slice(0, BLUEPRINT_LIMITS.resource.urlMax);
    }
  } catch {
    return '';
  }
  return '';
}

function clampString(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

function assertValidDate(dateStr: string, label: string): string {
  const trimmed = dateStr.trim();
  if (!BLUEPRINT_LIMITS.datePattern.test(trimmed)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
  return trimmed;
}

export async function ensureTeacherAndPreloadedStudents(user: User): Promise<void> {
  const teacherPath = `teachers/${user.uid}`;
  const teacherRef = doc(db, 'teachers', user.uid);
  let seededDefaults = false;

  try {
    const snap = await getDoc(teacherRef);
    if (!snap.exists()) {
      const displayName = clampString(user.displayName || user.email?.split('@')[0] || 'Teacher', 120);
      const email = clampString(user.email || 'teacher@youngandcode.local', 160);
      await setDoc(teacherRef, {
        uid: user.uid,
        displayName,
        email,
        seededDefaults: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      seededDefaults = Boolean(data.seededDefaults);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, teacherPath);
  }

  if (seededDefaults) {
    // One-time non-destructive backfill if initial profiles were created before age/grade fields existed
    try {
      const existingStudentsSnap = await getDocs(
        query(collection(db, 'students'), where('teacherId', '==', user.uid))
      );
      const initialDefaultsByName: Record<string, { age: string; grade: string }> = {
        'Tahir Salawu': { age: '10', grade: 'Grade 5' },
        'Jaceyl Wisdom': { age: '', grade: 'Grade 7' },
        Janai: { age: '5', grade: '' },
      };
      const batch = writeBatch(db);
      let hasUpdates = false;
      for (const d of existingStudentsSnap.docs) {
        const data = d.data();
        const defaults = initialDefaultsByName[String(data.fullName ?? '')];
        if (defaults && data.age === undefined && data.grade === undefined) {
          batch.update(d.ref, {
            age: defaults.age,
            grade: defaults.grade,
            ageGroup: data.ageGroup === 'Primary / Middle' ? '' : (data.ageGroup ?? ''),
            updatedAt: serverTimestamp(),
          });
          hasUpdates = true;
        }
      }
      if (hasUpdates) {
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'students');
    }
    return;
  }

  try {
    const existingQuery = query(
      collection(db, 'students'),
      where('teacherId', '==', user.uid),
      limit(1)
    );
    const existingSnap = await getDocs(existingQuery);

    if (existingSnap.empty) {
      const batch = writeBatch(db);
      const preloadedStudents: Array<{
        fullName: string;
        age: string;
        grade: string;
        subjects: Subject[];
      }> = [
        {
          fullName: 'Tahir Salawu',
          age: '10',
          grade: 'Grade 5',
          subjects: [Subject.MATHEMATICS, Subject.TECHNOLOGY],
        },
        {
          fullName: 'Jaceyl Wisdom',
          age: '',
          grade: 'Grade 7',
          subjects: [Subject.TECHNOLOGY],
        },
        {
          fullName: 'Janai',
          age: '5',
          grade: '',
          subjects: [Subject.TECHNOLOGY],
        },
      ];

      for (const s of preloadedStudents) {
        const studentDocRef = doc(collection(db, 'students'));
        batch.set(studentDocRef, {
          teacherId: user.uid,
          fullName: s.fullName,
          subjects: s.subjects,
          age: s.age,
          grade: s.grade,
          school: '',
          guardianName: '',
          teachingNotes: '',
          learningGoals: '',
          progressSummary: '',
          mathLevel: '',
          techLevel: '',
          status: StudentStatus.ACTIVE,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      batch.update(teacherRef, {
        seededDefaults: true,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } else {
      await updateDoc(teacherRef, {
        seededDefaults: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'students');
  }
}

export interface WorkspaceSubscriptions {
  onStudents: (students: Student[]) => void;
  onLessonPlans: (plans: LessonPlan[]) => void;
  onClassReports: (reports: ClassReport[]) => void;
  onAiReports?: (aiReports: ApprovedAiReport[]) => void;
  onHomework: (items: Homework[]) => void;
  onResources: (resources: StudentResource[]) => void;
  onMonthlyReports?: (reports: MonthlyReport[]) => void;
  onIntegrations?: (integrations: TeacherIntegration[]) => void;
  onError: (errMsg: string) => void;
}

export function subscribeTeacherWorkspace(
  teacherId: string,
  callbacks: WorkspaceSubscriptions
): () => void {
  const qStudents = query(collection(db, 'students'), where('teacherId', '==', teacherId));
  const qPlans = query(collection(db, 'lessonPlans'), where('teacherId', '==', teacherId));
  const qReports = query(collection(db, 'classReports'), where('teacherId', '==', teacherId));
  const qAiReports = query(collection(db, 'aiReports'), where('teacherId', '==', teacherId));
  const qHomework = query(collection(db, 'homework'), where('teacherId', '==', teacherId));
  const qResources = query(collection(db, 'resources'), where('teacherId', '==', teacherId));
  const qMonthlyReports = query(
    collection(db, 'monthlyReports'),
    where('teacherId', '==', teacherId)
  );
  const qIntegrations = query(
    collection(db, 'integrations'),
    where('teacherId', '==', teacherId)
  );

  const unsubStudents = onSnapshot(
    qStudents,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Student, 'id'>) }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      callbacks.onStudents(list);
    },
    (error) => {
      callbacks.onError('Unable to load student records from Firestore.');
      handleFirestoreError(error, OperationType.LIST, 'students');
    }
  );

  const unsubPlans = onSnapshot(
    qPlans,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<LessonPlan, 'id'>) }))
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      callbacks.onLessonPlans(list);
    },
    (error) => {
      callbacks.onError('Unable to load lesson plans from Firestore.');
      handleFirestoreError(error, OperationType.LIST, 'lessonPlans');
    }
  );

  const unsubReports = onSnapshot(
    qReports,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ClassReport, 'id'>) }))
        .sort((a, b) => {
          const dateCmp = b.sessionDate.localeCompare(a.sessionDate);
          if (dateCmp !== 0) return dateCmp;
          return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
        });
      callbacks.onClassReports(list);
    },
    (error) => {
      callbacks.onError('Unable to load class reports from Firestore.');
      handleFirestoreError(error, OperationType.LIST, 'classReports');
    }
  );

  const unsubHomework = onSnapshot(
    qHomework,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Homework, 'id'>) }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      callbacks.onHomework(list);
    },
    (error) => {
      callbacks.onError('Unable to load homework assignments from Firestore.');
      handleFirestoreError(error, OperationType.LIST, 'homework');
    }
  );

  const unsubResources = onSnapshot(
    qResources,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StudentResource, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      callbacks.onResources(list);
    },
    (error) => {
      callbacks.onError('Unable to load student resources from Firestore.');
      handleFirestoreError(error, OperationType.LIST, 'resources');
    }
  );

  const unsubAiReports = callbacks.onAiReports
    ? onSnapshot(
        qAiReports,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ApprovedAiReport, 'id'>) }))
            .sort((a, b) => {
              const dateCmp = b.sessionDate.localeCompare(a.sessionDate);
              if (dateCmp !== 0) return dateCmp;
              return (b.approvedAt?.toMillis?.() ?? 0) - (a.approvedAt?.toMillis?.() ?? 0);
            });
          callbacks.onAiReports?.(list);
        },
        (error) => {
          callbacks.onError('Unable to load approved AI reports from Firestore.');
          handleFirestoreError(error, OperationType.LIST, 'aiReports');
        }
      )
    : undefined;

  const unsubMonthlyReports = callbacks.onMonthlyReports
    ? onSnapshot(
        qMonthlyReports,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<MonthlyReport, 'id'>) }))
            .sort((a, b) => {
              const monthCmp = b.monthKey.localeCompare(a.monthKey);
              if (monthCmp !== 0) return monthCmp;
              return (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0);
            });
          callbacks.onMonthlyReports?.(list);
        },
        (error) => {
          callbacks.onError('Unable to load monthly progress reports from Firestore.');
          handleFirestoreError(error, OperationType.LIST, 'monthlyReports');
        }
      )
    : undefined;

  const unsubIntegrations = callbacks.onIntegrations
    ? onSnapshot(
        qIntegrations,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<TeacherIntegration, 'id'>) }))
            .sort((a, b) => a.name.localeCompare(b.name));
          callbacks.onIntegrations?.(list);
        },
        (error) => {
          callbacks.onError('Unable to load integrations from Firestore.');
          handleFirestoreError(error, OperationType.LIST, 'integrations');
        }
      )
    : undefined;

  return () => {
    unsubStudents();
    unsubPlans();
    unsubReports();
    unsubAiReports?.();
    unsubHomework();
    unsubResources();
    unsubMonthlyReports?.();
    unsubIntegrations?.();
  };
}

// --- Student CRUD ---

export interface StudentInput {
  fullName: string;
  subjects: Subject[];
  age?: string;
  grade?: string;
  school?: string;
  ageGroup?: string;
  guardianName?: string;
  teachingNotes?: string;
  learningGoals?: string;
  progressSummary?: string;
  mathLevel?: string;
  techLevel?: string;
}

export async function createStudent(teacherId: string, input: StudentInput): Promise<string> {
  const fullName = clampString(input.fullName, BLUEPRINT_LIMITS.student.fullNameMax);
  if (!fullName) throw new Error('Student name is required.');
  const subjects = Array.from(new Set(input.subjects)).filter(
    (s) => s === Subject.MATHEMATICS || s === Subject.TECHNOLOGY
  );
  if (subjects.length === 0) throw new Error('Select at least one subject.');

  try {
    const ref = await addDoc(collection(db, 'students'), {
      teacherId,
      fullName,
      subjects,
      age: clampString(input.age, BLUEPRINT_LIMITS.student.ageMax),
      grade: clampString(input.grade, BLUEPRINT_LIMITS.student.gradeMax),
      school: clampString(input.school, BLUEPRINT_LIMITS.student.schoolMax),
      guardianName: clampString(input.guardianName, BLUEPRINT_LIMITS.student.guardianNameMax),
      teachingNotes: clampString(input.teachingNotes, BLUEPRINT_LIMITS.student.teachingNotesMax),
      learningGoals: clampString(input.learningGoals, BLUEPRINT_LIMITS.student.learningGoalsMax),
      progressSummary: clampString(input.progressSummary, BLUEPRINT_LIMITS.student.progressSummaryMax),
      mathLevel: clampString(input.mathLevel, BLUEPRINT_LIMITS.student.levelMax),
      techLevel: clampString(input.techLevel, BLUEPRINT_LIMITS.student.levelMax),
      status: StudentStatus.ACTIVE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'students');
  }
}

export async function updateStudent(
  studentId: string,
  input: Partial<StudentInput> & { status?: StudentStatus }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.fullName !== undefined) {
    const fullName = clampString(input.fullName, BLUEPRINT_LIMITS.student.fullNameMax);
    if (!fullName) throw new Error('Student name is required.');
    payload.fullName = fullName;
  }
  if (input.subjects !== undefined) {
    const subjects = Array.from(new Set(input.subjects)).filter(
      (s) => s === Subject.MATHEMATICS || s === Subject.TECHNOLOGY
    );
    if (subjects.length === 0) throw new Error('Select at least one subject.');
    payload.subjects = subjects;
  }
  if (input.age !== undefined) {
    payload.age = clampString(input.age, BLUEPRINT_LIMITS.student.ageMax);
  }
  if (input.grade !== undefined) {
    payload.grade = clampString(input.grade, BLUEPRINT_LIMITS.student.gradeMax);
  }
  if (input.school !== undefined) {
    payload.school = clampString(input.school, BLUEPRINT_LIMITS.student.schoolMax);
  }
  if (input.ageGroup !== undefined) {
    payload.ageGroup = clampString(input.ageGroup, BLUEPRINT_LIMITS.student.ageGroupMax);
  }
  if (input.guardianName !== undefined) {
    payload.guardianName = clampString(input.guardianName, BLUEPRINT_LIMITS.student.guardianNameMax);
  }
  if (input.teachingNotes !== undefined) {
    payload.teachingNotes = clampString(input.teachingNotes, BLUEPRINT_LIMITS.student.teachingNotesMax);
  }
  if (input.learningGoals !== undefined) {
    payload.learningGoals = clampString(input.learningGoals, BLUEPRINT_LIMITS.student.learningGoalsMax);
  }
  if (input.progressSummary !== undefined) {
    payload.progressSummary = clampString(input.progressSummary, BLUEPRINT_LIMITS.student.progressSummaryMax);
  }
  if (input.mathLevel !== undefined) {
    payload.mathLevel = clampString(input.mathLevel, BLUEPRINT_LIMITS.student.levelMax);
  }
  if (input.techLevel !== undefined) {
    payload.techLevel = clampString(input.techLevel, BLUEPRINT_LIMITS.student.levelMax);
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }

  try {
    await updateDoc(doc(db, 'students', studentId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${studentId}`);
  }
}

export async function deleteStudentRecord(studentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'students', studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `students/${studentId}`);
  }
}

// --- Lesson Plan CRUD ---

export interface LessonPlanInput {
  studentId: string;
  studentName: string;
  subject: Subject;
  topic: string;
  scheduledDate: string;
  scheduledTime?: string;
  durationMinutes?: number;
  learningObjectives: string;
  previousKnowledge?: string;
  lessonIntroduction?: string;
  teachingMaterials?: string;
  activities: string;
  practicalExercises?: string;
  classwork?: string;
  homework?: string;
  expectedOutcomes?: string;
  status?: LessonPlanStatus;
}

function assertValidDuration(durationMinutes: number | undefined): number {
  const val = durationMinutes === undefined ? 45 : Math.round(durationMinutes);
  if (!Number.isFinite(val) || val < 1 || val > BLUEPRINT_LIMITS.lessonPlan.durationMax) {
    throw new Error(`Lesson duration must be between 1 and ${BLUEPRINT_LIMITS.lessonPlan.durationMax} minutes.`);
  }
  return val;
}

export async function createLessonPlan(teacherId: string, input: LessonPlanInput): Promise<string> {
  const topic = clampString(input.topic, BLUEPRINT_LIMITS.lessonPlan.topicMax);
  const objectives = clampString(input.learningObjectives, BLUEPRINT_LIMITS.lessonPlan.learningObjectivesMax);
  const activities = clampString(input.activities, BLUEPRINT_LIMITS.lessonPlan.activitiesMax);
  const scheduledDate = assertValidDate(input.scheduledDate, 'Lesson date');
  const durationMinutes = assertValidDuration(input.durationMinutes);
  const status = input.status ?? LessonPlanStatus.SCHEDULED;

  if (!topic) throw new Error('Lesson topic is required.');
  if (status !== LessonPlanStatus.DRAFT && status !== LessonPlanStatus.CANCELLED) {
    if (!objectives) throw new Error('Learning objectives are required.');
    if (!activities) throw new Error('Step-by-step lesson activities are required.');
  }

  try {
    const ref = await addDoc(collection(db, 'lessonPlans'), {
      teacherId,
      studentId: input.studentId,
      studentName: clampString(input.studentName, BLUEPRINT_LIMITS.student.fullNameMax),
      subject: input.subject,
      topic,
      scheduledDate,
      scheduledTime: clampString(input.scheduledTime, BLUEPRINT_LIMITS.lessonPlan.scheduledTimeMax),
      durationMinutes,
      learningObjectives: objectives,
      previousKnowledge: clampString(input.previousKnowledge, BLUEPRINT_LIMITS.lessonPlan.previousKnowledgeMax),
      lessonIntroduction: clampString(input.lessonIntroduction, BLUEPRINT_LIMITS.lessonPlan.lessonIntroductionMax),
      teachingMaterials: clampString(input.teachingMaterials, BLUEPRINT_LIMITS.lessonPlan.teachingMaterialsMax),
      activities,
      practicalExercises: clampString(input.practicalExercises, BLUEPRINT_LIMITS.lessonPlan.practicalExercisesMax),
      classwork: clampString(input.classwork, BLUEPRINT_LIMITS.lessonPlan.classworkMax),
      homework: clampString(input.homework, BLUEPRINT_LIMITS.lessonPlan.homeworkMax),
      expectedOutcomes: clampString(input.expectedOutcomes, BLUEPRINT_LIMITS.lessonPlan.expectedOutcomesMax),
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'lessonPlans');
  }
}

export async function updateLessonPlan(
  planId: string,
  input: Partial<Omit<LessonPlanInput, 'studentId'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.studentName !== undefined) {
    payload.studentName = clampString(input.studentName, BLUEPRINT_LIMITS.student.fullNameMax);
  }
  if (input.subject !== undefined) payload.subject = input.subject;
  if (input.topic !== undefined) {
    const topic = clampString(input.topic, BLUEPRINT_LIMITS.lessonPlan.topicMax);
    if (!topic) throw new Error('Lesson topic is required.');
    payload.topic = topic;
  }
  if (input.scheduledDate !== undefined) {
    payload.scheduledDate = assertValidDate(input.scheduledDate, 'Lesson date');
  }
  if (input.scheduledTime !== undefined) {
    payload.scheduledTime = clampString(input.scheduledTime, BLUEPRINT_LIMITS.lessonPlan.scheduledTimeMax);
  }
  if (input.durationMinutes !== undefined) {
    payload.durationMinutes = assertValidDuration(input.durationMinutes);
  }
  if (input.learningObjectives !== undefined) {
    const objectives = clampString(input.learningObjectives, BLUEPRINT_LIMITS.lessonPlan.learningObjectivesMax);
    if (
      input.status &&
      input.status !== LessonPlanStatus.DRAFT &&
      input.status !== LessonPlanStatus.CANCELLED &&
      !objectives
    ) {
      throw new Error('Learning objectives are required.');
    }
    payload.learningObjectives = objectives;
  }
  if (input.previousKnowledge !== undefined) {
    payload.previousKnowledge = clampString(
      input.previousKnowledge,
      BLUEPRINT_LIMITS.lessonPlan.previousKnowledgeMax
    );
  }
  if (input.lessonIntroduction !== undefined) {
    payload.lessonIntroduction = clampString(
      input.lessonIntroduction,
      BLUEPRINT_LIMITS.lessonPlan.lessonIntroductionMax
    );
  }
  if (input.teachingMaterials !== undefined) {
    payload.teachingMaterials = clampString(
      input.teachingMaterials,
      BLUEPRINT_LIMITS.lessonPlan.teachingMaterialsMax
    );
  }
  if (input.activities !== undefined) {
    const activities = clampString(input.activities, BLUEPRINT_LIMITS.lessonPlan.activitiesMax);
    if (
      input.status &&
      input.status !== LessonPlanStatus.DRAFT &&
      input.status !== LessonPlanStatus.CANCELLED &&
      !activities
    ) {
      throw new Error('Step-by-step lesson activities are required.');
    }
    payload.activities = activities;
  }
  if (input.practicalExercises !== undefined) {
    payload.practicalExercises = clampString(
      input.practicalExercises,
      BLUEPRINT_LIMITS.lessonPlan.practicalExercisesMax
    );
  }
  if (input.classwork !== undefined) {
    payload.classwork = clampString(input.classwork, BLUEPRINT_LIMITS.lessonPlan.classworkMax);
  }
  if (input.homework !== undefined) {
    payload.homework = clampString(input.homework, BLUEPRINT_LIMITS.lessonPlan.homeworkMax);
  }
  if (input.expectedOutcomes !== undefined) {
    payload.expectedOutcomes = clampString(
      input.expectedOutcomes,
      BLUEPRINT_LIMITS.lessonPlan.expectedOutcomesMax
    );
  }
  if (input.status !== undefined) payload.status = input.status;

  try {
    await updateDoc(doc(db, 'lessonPlans', planId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `lessonPlans/${planId}`);
  }
}

export async function deleteLessonPlan(planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'lessonPlans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `lessonPlans/${planId}`);
  }
}

// --- Class Documentation / Reports CRUD ---

export interface StartClassInput {
  studentId: string;
  studentName: string;
  subject: Subject;
  topic: string;
  lessonPlanId?: string;
  sessionDate?: string;
  durationMinutes?: number;
  objectivesCovered?: string;
  conceptsTaught?: string;
  activitiesCompleted?: string;
  practicalExercisesPerformed?: string;
  classworkGiven?: string;
  homeworkAssigned?: string;
  status?: ClassReportStatus;
}

export async function startClassSession(teacherId: string, input: StartClassInput): Promise<string> {
  const topic = clampString(input.topic, BLUEPRINT_LIMITS.classReport.topicMax);
  if (!topic) throw new Error('Lesson topic is required to start a class.');
  const sessionDate = assertValidDate(input.sessionDate || todayIsoDate(), 'Session date');
  const durationMinutes =
    input.durationMinutes === undefined
      ? 45
      : Math.max(0, Math.min(BLUEPRINT_LIMITS.classReport.durationMax, Math.round(input.durationMinutes)));

  try {
    const docData: Record<string, unknown> = {
      teacherId,
      studentId: input.studentId,
      studentName: clampString(input.studentName, BLUEPRINT_LIMITS.student.fullNameMax),
      subject: input.subject,
      topic,
      sessionDate,
      durationMinutes,
      startedAtIso: new Date().toISOString(),
      objectivesCovered: clampString(input.objectivesCovered, BLUEPRINT_LIMITS.classReport.objectivesCoveredMax),
      conceptsTaught: clampString(input.conceptsTaught, BLUEPRINT_LIMITS.classReport.conceptsTaughtMax),
      activitiesCompleted: clampString(input.activitiesCompleted, BLUEPRINT_LIMITS.classReport.activitiesCompletedMax),
      practicalExercisesPerformed: clampString(
        input.practicalExercisesPerformed,
        BLUEPRINT_LIMITS.classReport.practicalExercisesPerformedMax
      ),
      classworkGiven: clampString(input.classworkGiven, BLUEPRINT_LIMITS.classReport.classworkGivenMax),
      studentParticipation: '',
      understoodWell: '',
      struggledWith: '',
      challengesEncountered: '',
      homeworkAssigned: clampString(input.homeworkAssigned, BLUEPRINT_LIMITS.classReport.homeworkAssignedMax),
      teacherObservations: '',
      recommendationsNextFocus: '',
      notes: '',
      progressNotes: '',
      understandingLevel: UnderstandingLevel.STEADY,
      status: input.status ?? ClassReportStatus.IN_PROGRESS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (input.lessonPlanId && BLUEPRINT_LIMITS.idPattern.test(input.lessonPlanId)) {
      docData.lessonPlanId = input.lessonPlanId;
    }

    const ref = await addDoc(collection(db, 'classReports'), docData);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'classReports');
  }
}

export interface UpdateClassReportInput {
  topic?: string;
  subject?: Subject;
  lessonPlanId?: string;
  sessionDate?: string;
  durationMinutes?: number;
  objectivesCovered?: string;
  conceptsTaught?: string;
  activitiesCompleted?: string;
  practicalExercisesPerformed?: string;
  classworkGiven?: string;
  studentParticipation?: string;
  understoodWell?: string;
  struggledWith?: string;
  challengesEncountered?: string;
  homeworkAssigned?: string;
  teacherObservations?: string;
  recommendationsNextFocus?: string;
  notes?: string;
  progressNotes?: string;
  understandingLevel?: UnderstandingLevel;
  status?: ClassReportStatus;
}

export async function updateClassReport(
  reportId: string,
  input: UpdateClassReportInput
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.topic !== undefined) {
    const topic = clampString(input.topic, BLUEPRINT_LIMITS.classReport.topicMax);
    if (!topic) throw new Error('Lesson topic is required.');
    payload.topic = topic;
  }
  if (input.subject !== undefined) payload.subject = input.subject;
  if (input.lessonPlanId !== undefined) {
    const trimmedId = input.lessonPlanId.trim();
    if (!trimmedId) {
      payload.lessonPlanId = '';
    } else if (BLUEPRINT_LIMITS.idPattern.test(trimmedId)) {
      payload.lessonPlanId = trimmedId;
    }
  }
  if (input.sessionDate !== undefined) {
    payload.sessionDate = assertValidDate(input.sessionDate, 'Session date');
  }
  if (input.durationMinutes !== undefined) {
    const mins = Math.max(0, Math.min(BLUEPRINT_LIMITS.classReport.durationMax, Math.round(input.durationMinutes)));
    payload.durationMinutes = mins;
  }
  if (input.objectivesCovered !== undefined) {
    payload.objectivesCovered = clampString(
      input.objectivesCovered,
      BLUEPRINT_LIMITS.classReport.objectivesCoveredMax
    );
  }
  if (input.conceptsTaught !== undefined) {
    payload.conceptsTaught = clampString(
      input.conceptsTaught,
      BLUEPRINT_LIMITS.classReport.conceptsTaughtMax
    );
  }
  if (input.activitiesCompleted !== undefined) {
    payload.activitiesCompleted = clampString(
      input.activitiesCompleted,
      BLUEPRINT_LIMITS.classReport.activitiesCompletedMax
    );
  }
  if (input.practicalExercisesPerformed !== undefined) {
    payload.practicalExercisesPerformed = clampString(
      input.practicalExercisesPerformed,
      BLUEPRINT_LIMITS.classReport.practicalExercisesPerformedMax
    );
  }
  if (input.classworkGiven !== undefined) {
    payload.classworkGiven = clampString(
      input.classworkGiven,
      BLUEPRINT_LIMITS.classReport.classworkGivenMax
    );
  }
  if (input.studentParticipation !== undefined) {
    payload.studentParticipation = clampString(
      input.studentParticipation,
      BLUEPRINT_LIMITS.classReport.studentParticipationMax
    );
  }
  if (input.understoodWell !== undefined) {
    payload.understoodWell = clampString(
      input.understoodWell,
      BLUEPRINT_LIMITS.classReport.understoodWellMax
    );
  }
  if (input.struggledWith !== undefined) {
    payload.struggledWith = clampString(
      input.struggledWith,
      BLUEPRINT_LIMITS.classReport.struggledWithMax
    );
  }
  if (input.challengesEncountered !== undefined) {
    payload.challengesEncountered = clampString(
      input.challengesEncountered,
      BLUEPRINT_LIMITS.classReport.challengesEncounteredMax
    );
  }
  if (input.homeworkAssigned !== undefined) {
    payload.homeworkAssigned = clampString(
      input.homeworkAssigned,
      BLUEPRINT_LIMITS.classReport.homeworkAssignedMax
    );
  }
  if (input.teacherObservations !== undefined) {
    payload.teacherObservations = clampString(
      input.teacherObservations,
      BLUEPRINT_LIMITS.classReport.teacherObservationsMax
    );
  }
  if (input.recommendationsNextFocus !== undefined) {
    payload.recommendationsNextFocus = clampString(
      input.recommendationsNextFocus,
      BLUEPRINT_LIMITS.classReport.recommendationsNextFocusMax
    );
  }
  if (input.notes !== undefined) {
    payload.notes = clampString(input.notes, BLUEPRINT_LIMITS.classReport.notesMax);
  }
  if (input.progressNotes !== undefined) {
    payload.progressNotes = clampString(input.progressNotes, BLUEPRINT_LIMITS.classReport.progressNotesMax);
  }
  if (input.understandingLevel !== undefined) {
    payload.understandingLevel = input.understandingLevel;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }

  try {
    await updateDoc(doc(db, 'classReports', reportId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `classReports/${reportId}`);
  }
}

export async function deleteClassReport(reportId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'classReports', reportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `classReports/${reportId}`);
  }
}

// --- Approved AI Reports CRUD ---

export interface CreateApprovedAiReportInput extends AiReportDraft {
  studentId: string;
  classReportId: string;
  sessionDate: string;
}

export async function createApprovedAiReport(
  teacherId: string,
  input: CreateApprovedAiReportInput
): Promise<string> {
  const studentName = clampString(input.studentName, BLUEPRINT_LIMITS.aiReport.studentNameMax);
  const lessonTopic = clampString(input.lessonTopic, BLUEPRINT_LIMITS.aiReport.lessonTopicMax);
  const dateAndDuration = clampString(
    input.dateAndDuration,
    BLUEPRINT_LIMITS.aiReport.dateAndDurationMax
  );
  if (!studentName) throw new Error('Student name is required.');
  if (!lessonTopic) throw new Error('Lesson topic is required.');
  if (!dateAndDuration) throw new Error('Date and duration is required.');
  const sessionDate = assertValidDate(input.sessionDate, 'Session date');

  if (!BLUEPRINT_LIMITS.idPattern.test(input.studentId)) {
    throw new Error('Invalid student reference.');
  }
  if (!BLUEPRINT_LIMITS.idPattern.test(input.classReportId)) {
    throw new Error('Invalid class documentation reference.');
  }

  try {
    const ref = await addDoc(collection(db, 'aiReports'), {
      teacherId,
      studentId: input.studentId,
      classReportId: input.classReportId,
      studentName,
      subject: input.subject,
      lessonTopic,
      dateAndDuration,
      sessionDate,
      learningObjectivesCovered: clampString(
        input.learningObjectivesCovered,
        BLUEPRINT_LIMITS.aiReport.learningObjectivesCoveredMax
      ),
      conceptsTaught: clampString(
        input.conceptsTaught,
        BLUEPRINT_LIMITS.aiReport.conceptsTaughtMax
      ),
      activitiesAndExercisesCompleted: clampString(
        input.activitiesAndExercisesCompleted,
        BLUEPRINT_LIMITS.aiReport.activitiesAndExercisesCompletedMax
      ),
      studentParticipation: clampString(
        input.studentParticipation,
        BLUEPRINT_LIMITS.aiReport.studentParticipationMax
      ),
      demonstratedUnderstanding: clampString(
        input.demonstratedUnderstanding,
        BLUEPRINT_LIMITS.aiReport.demonstratedUnderstandingMax
      ),
      areasRequiringImprovement: clampString(
        input.areasRequiringImprovement,
        BLUEPRINT_LIMITS.aiReport.areasRequiringImprovementMax
      ),
      challengesEncountered: clampString(
        input.challengesEncountered,
        BLUEPRINT_LIMITS.aiReport.challengesEncounteredMax
      ),
      homeworkAssigned: clampString(
        input.homeworkAssigned,
        BLUEPRINT_LIMITS.aiReport.homeworkAssignedMax
      ),
      teacherObservations: clampString(
        input.teacherObservations,
        BLUEPRINT_LIMITS.aiReport.teacherObservationsMax
      ),
      recommendedNextSteps: clampString(
        input.recommendedNextSteps,
        BLUEPRINT_LIMITS.aiReport.recommendedNextStepsMax
      ),
      status: 'approved',
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'aiReports');
  }
}

export async function updateApprovedAiReport(
  aiReportId: string,
  input: Partial<AiReportDraft> & { sessionDate?: string }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.studentName !== undefined) {
    const studentName = clampString(
      input.studentName,
      BLUEPRINT_LIMITS.aiReport.studentNameMax
    );
    if (!studentName) throw new Error('Student name is required.');
    payload.studentName = studentName;
  }
  if (input.subject !== undefined) payload.subject = input.subject;
  if (input.lessonTopic !== undefined) {
    const lessonTopic = clampString(
      input.lessonTopic,
      BLUEPRINT_LIMITS.aiReport.lessonTopicMax
    );
    if (!lessonTopic) throw new Error('Lesson topic is required.');
    payload.lessonTopic = lessonTopic;
  }
  if (input.dateAndDuration !== undefined) {
    const dateAndDuration = clampString(
      input.dateAndDuration,
      BLUEPRINT_LIMITS.aiReport.dateAndDurationMax
    );
    if (!dateAndDuration) throw new Error('Date and duration is required.');
    payload.dateAndDuration = dateAndDuration;
  }
  if (input.sessionDate !== undefined) {
    payload.sessionDate = assertValidDate(input.sessionDate, 'Session date');
  }
  if (input.learningObjectivesCovered !== undefined) {
    payload.learningObjectivesCovered = clampString(
      input.learningObjectivesCovered,
      BLUEPRINT_LIMITS.aiReport.learningObjectivesCoveredMax
    );
  }
  if (input.conceptsTaught !== undefined) {
    payload.conceptsTaught = clampString(
      input.conceptsTaught,
      BLUEPRINT_LIMITS.aiReport.conceptsTaughtMax
    );
  }
  if (input.activitiesAndExercisesCompleted !== undefined) {
    payload.activitiesAndExercisesCompleted = clampString(
      input.activitiesAndExercisesCompleted,
      BLUEPRINT_LIMITS.aiReport.activitiesAndExercisesCompletedMax
    );
  }
  if (input.studentParticipation !== undefined) {
    payload.studentParticipation = clampString(
      input.studentParticipation,
      BLUEPRINT_LIMITS.aiReport.studentParticipationMax
    );
  }
  if (input.demonstratedUnderstanding !== undefined) {
    payload.demonstratedUnderstanding = clampString(
      input.demonstratedUnderstanding,
      BLUEPRINT_LIMITS.aiReport.demonstratedUnderstandingMax
    );
  }
  if (input.areasRequiringImprovement !== undefined) {
    payload.areasRequiringImprovement = clampString(
      input.areasRequiringImprovement,
      BLUEPRINT_LIMITS.aiReport.areasRequiringImprovementMax
    );
  }
  if (input.challengesEncountered !== undefined) {
    payload.challengesEncountered = clampString(
      input.challengesEncountered,
      BLUEPRINT_LIMITS.aiReport.challengesEncounteredMax
    );
  }
  if (input.homeworkAssigned !== undefined) {
    payload.homeworkAssigned = clampString(
      input.homeworkAssigned,
      BLUEPRINT_LIMITS.aiReport.homeworkAssignedMax
    );
  }
  if (input.teacherObservations !== undefined) {
    payload.teacherObservations = clampString(
      input.teacherObservations,
      BLUEPRINT_LIMITS.aiReport.teacherObservationsMax
    );
  }
  if (input.recommendedNextSteps !== undefined) {
    payload.recommendedNextSteps = clampString(
      input.recommendedNextSteps,
      BLUEPRINT_LIMITS.aiReport.recommendedNextStepsMax
    );
  }

  try {
    await updateDoc(doc(db, 'aiReports', aiReportId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `aiReports/${aiReportId}`);
  }
}

export async function deleteApprovedAiReport(aiReportId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'aiReports', aiReportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `aiReports/${aiReportId}`);
  }
}

// --- Homework CRUD ---

export interface HomeworkInput {
  studentId: string;
  studentName: string;
  subject: Subject;
  title: string;
  instructions?: string;
  questionsOrTasks?: string;
  assignedDate?: string;
  dueDate: string;
  status?: HomeworkStatus;
  supportingLinks?: HomeworkLink[];
  lessonPlanId?: string;
  classReportId?: string;
  submittedDate?: string;
  studentWorkSummary?: string;
  submissionLinks?: HomeworkLink[];
  score?: string;
  feedback?: string;
  areasForImprovement?: string;
}

const VALID_HOMEWORK_LINK_KINDS = new Set<string>([
  HomeworkLinkKind.GOOGLE_DOC,
  HomeworkLinkKind.MIRO,
  HomeworkLinkKind.YOUTUBE,
  HomeworkLinkKind.WORKSHEET,
  HomeworkLinkKind.OTHER,
]);

function assertOptionalDate(dateStr: string | undefined, label: string): string {
  const trimmed = (dateStr ?? '').trim();
  if (!trimmed) return '';
  if (!BLUEPRINT_LIMITS.datePattern.test(trimmed)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }
  return trimmed;
}

function sanitizeHomeworkLinks(
  links: HomeworkLink[] | undefined,
  label: string
): HomeworkLink[] {
  if (!links || links.length === 0) return [];
  if (links.length > BLUEPRINT_LIMITS.homework.maxLinks) {
    throw new Error(`A maximum of ${BLUEPRINT_LIMITS.homework.maxLinks} ${label} links are allowed.`);
  }
  return links.map((link) => {
    const safeUrl = sanitizeHttpUrl(link.url);
    if (!safeUrl || safeUrl.length < 8) {
      throw new Error(`All ${label} links must start with https:// or http://`);
    }
    const title =
      clampString(link.title, BLUEPRINT_LIMITS.homework.linkTitleMax) || safeUrl.slice(0, 60);
    const kind = VALID_HOMEWORK_LINK_KINDS.has(link.kind)
      ? (link.kind as HomeworkLinkKind)
      : HomeworkLinkKind.OTHER;
    return { title, url: safeUrl, kind };
  });
}

function sanitizeOptionalRefId(rawId: string | undefined): string {
  const trimmed = (rawId ?? '').trim();
  if (!trimmed) return '';
  if (!BLUEPRINT_LIMITS.idPattern.test(trimmed) || trimmed.length > 128) {
    throw new Error('Invalid lesson or class record reference.');
  }
  return trimmed;
}

export async function createHomework(teacherId: string, input: HomeworkInput): Promise<string> {
  const title = clampString(input.title, BLUEPRINT_LIMITS.homework.titleMax);
  if (!title) throw new Error('Homework title is required.');
  const dueDate = assertValidDate(input.dueDate, 'Due date');
  const assignedDate = assertOptionalDate(input.assignedDate, 'Date assigned') || todayIsoDate();
  const submittedDate = assertOptionalDate(input.submittedDate, 'Submission date');
  const supportingLinks = sanitizeHomeworkLinks(input.supportingLinks, 'supporting resource');
  const submissionLinks = sanitizeHomeworkLinks(input.submissionLinks, 'submission');
  const lessonPlanId = sanitizeOptionalRefId(input.lessonPlanId);
  const classReportId = sanitizeOptionalRefId(input.classReportId);

  try {
    const docData: Record<string, unknown> = {
      teacherId,
      studentId: input.studentId,
      studentName: clampString(input.studentName, BLUEPRINT_LIMITS.student.fullNameMax),
      subject: input.subject,
      title,
      instructions: clampString(input.instructions, BLUEPRINT_LIMITS.homework.instructionsMax),
      questionsOrTasks: clampString(
        input.questionsOrTasks,
        BLUEPRINT_LIMITS.homework.questionsOrTasksMax
      ),
      assignedDate,
      dueDate,
      status: input.status ?? HomeworkStatus.ASSIGNED,
      supportingLinks,
      lessonPlanId,
      classReportId,
      submittedDate,
      studentWorkSummary: clampString(
        input.studentWorkSummary,
        BLUEPRINT_LIMITS.homework.studentWorkSummaryMax
      ),
      submissionLinks,
      score: clampString(input.score, BLUEPRINT_LIMITS.homework.scoreMax),
      feedback: clampString(input.feedback, BLUEPRINT_LIMITS.homework.feedbackMax),
      areasForImprovement: clampString(
        input.areasForImprovement,
        BLUEPRINT_LIMITS.homework.areasForImprovementMax
      ),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, 'homework'), docData);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'homework');
  }
}

export async function updateHomework(
  homeworkId: string,
  input: Partial<Omit<HomeworkInput, 'studentId'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.studentName !== undefined) {
    payload.studentName = clampString(input.studentName, BLUEPRINT_LIMITS.student.fullNameMax);
  }
  if (input.subject !== undefined) payload.subject = input.subject;
  if (input.title !== undefined) {
    const title = clampString(input.title, BLUEPRINT_LIMITS.homework.titleMax);
    if (!title) throw new Error('Homework title is required.');
    payload.title = title;
  }
  if (input.instructions !== undefined) {
    payload.instructions = clampString(input.instructions, BLUEPRINT_LIMITS.homework.instructionsMax);
  }
  if (input.questionsOrTasks !== undefined) {
    payload.questionsOrTasks = clampString(
      input.questionsOrTasks,
      BLUEPRINT_LIMITS.homework.questionsOrTasksMax
    );
  }
  if (input.assignedDate !== undefined) {
    payload.assignedDate = assertOptionalDate(input.assignedDate, 'Date assigned');
  }
  if (input.dueDate !== undefined) {
    payload.dueDate = assertValidDate(input.dueDate, 'Due date');
  }
  if (input.status !== undefined) payload.status = input.status;
  if (input.supportingLinks !== undefined) {
    payload.supportingLinks = sanitizeHomeworkLinks(
      input.supportingLinks,
      'supporting resource'
    );
  }
  if (input.lessonPlanId !== undefined) {
    payload.lessonPlanId = sanitizeOptionalRefId(input.lessonPlanId);
  }
  if (input.classReportId !== undefined) {
    payload.classReportId = sanitizeOptionalRefId(input.classReportId);
  }
  if (input.submittedDate !== undefined) {
    payload.submittedDate = assertOptionalDate(input.submittedDate, 'Submission date');
  }
  if (input.studentWorkSummary !== undefined) {
    payload.studentWorkSummary = clampString(
      input.studentWorkSummary,
      BLUEPRINT_LIMITS.homework.studentWorkSummaryMax
    );
  }
  if (input.submissionLinks !== undefined) {
    payload.submissionLinks = sanitizeHomeworkLinks(input.submissionLinks, 'submission');
  }
  if (input.score !== undefined) {
    payload.score = clampString(input.score, BLUEPRINT_LIMITS.homework.scoreMax);
  }
  if (input.feedback !== undefined) {
    payload.feedback = clampString(input.feedback, BLUEPRINT_LIMITS.homework.feedbackMax);
  }
  if (input.areasForImprovement !== undefined) {
    payload.areasForImprovement = clampString(
      input.areasForImprovement,
      BLUEPRINT_LIMITS.homework.areasForImprovementMax
    );
  }

  try {
    await updateDoc(doc(db, 'homework', homeworkId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `homework/${homeworkId}`);
  }
}

export async function deleteHomework(homeworkId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'homework', homeworkId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `homework/${homeworkId}`);
  }
}

// --- Student Resources CRUD ---

export interface ResourceInput {
  studentId: string;
  subject: Subject;
  title: string;
  resourceType: ResourceType;
  url?: string;
  notes?: string;
}

export async function createResource(teacherId: string, input: ResourceInput): Promise<string> {
  const title = clampString(input.title, BLUEPRINT_LIMITS.resource.titleMax);
  if (!title) throw new Error('Resource title is required.');

  const rawUrl = (input.url ?? '').trim();
  const safeUrl = sanitizeHttpUrl(rawUrl);
  if (rawUrl && !safeUrl) {
    throw new Error('Resource link must start with https:// or http://');
  }

  try {
    const ref = await addDoc(collection(db, 'resources'), {
      teacherId,
      studentId: input.studentId,
      subject: input.subject,
      title,
      resourceType: input.resourceType,
      url: safeUrl,
      notes: clampString(input.notes, BLUEPRINT_LIMITS.resource.notesMax),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'resources');
  }
}

export async function updateResource(
  resourceId: string,
  input: Partial<Omit<ResourceInput, 'studentId'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.subject !== undefined) payload.subject = input.subject;
  if (input.title !== undefined) {
    const title = clampString(input.title, BLUEPRINT_LIMITS.resource.titleMax);
    if (!title) throw new Error('Resource title is required.');
    payload.title = title;
  }
  if (input.resourceType !== undefined) payload.resourceType = input.resourceType;
  if (input.url !== undefined) {
    const rawUrl = input.url.trim();
    const safeUrl = sanitizeHttpUrl(rawUrl);
    if (rawUrl && !safeUrl) {
      throw new Error('Resource link must start with https:// or http://');
    }
    payload.url = safeUrl;
  }
  if (input.notes !== undefined) {
    payload.notes = clampString(input.notes, BLUEPRINT_LIMITS.resource.notesMax);
  }

  try {
    await updateDoc(doc(db, 'resources', resourceId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `resources/${resourceId}`);
  }
}

export async function deleteResource(resourceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'resources', resourceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `resources/${resourceId}`);
  }
}

// --- Monthly Academic Progress Reports CRUD ---

function sanitizeSubjectAssessments(
  list: MonthlySubjectAssessment[] | undefined
): MonthlySubjectAssessment[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, BLUEPRINT_LIMITS.monthlyReport.maxSubjectAssessments).map((item) => ({
    subject:
      item.subject === Subject.MATHEMATICS || item.subject === Subject.TECHNOLOGY
        ? item.subject
        : Subject.TECHNOLOGY,
    classesCompletedCount: Math.max(
      0,
      Math.min(200, Math.round(Number(item.classesCompletedCount) || 0))
    ),
    criteriaFocus: clampString(
      item.criteriaFocus,
      BLUEPRINT_LIMITS.monthlyReport.subjectCriteriaFocusMax
    ),
    coverageSummary: clampString(
      item.coverageSummary,
      BLUEPRINT_LIMITS.monthlyReport.subjectCoverageSummaryMax
    ),
    performanceAssessment: clampString(
      item.performanceAssessment,
      BLUEPRINT_LIMITS.monthlyReport.subjectPerformanceAssessmentMax
    ),
    nextSubjectFocus: clampString(
      item.nextSubjectFocus,
      BLUEPRINT_LIMITS.monthlyReport.subjectNextFocusMax
    ),
  }));
}

function clampMonthlyDraftPayload(input: MonthlyReportDraft) {
  const studentName = clampString(
    input.studentName,
    BLUEPRINT_LIMITS.monthlyReport.studentNameMax
  );
  if (!studentName) throw new Error('Student name is required.');

  const monthKey = input.monthKey.trim();
  if (!BLUEPRINT_LIMITS.monthlyReport.monthKeyPattern.test(monthKey)) {
    throw new Error('Reporting month key must be formatted as YYYY-MM.');
  }

  const reportYear = Math.max(2000, Math.min(2100, Math.round(Number(input.reportYear) || 2026)));
  const reportMonth = Math.max(1, Math.min(12, Math.round(Number(input.reportMonth) || 1)));
  const reportingMonthLabel = clampString(
    input.reportingMonthLabel,
    BLUEPRINT_LIMITS.monthlyReport.reportingMonthLabelMax
  );
  if (!reportingMonthLabel) throw new Error('Reporting month label is required.');

  const subjectsCovered = clampString(
    input.subjectsCovered,
    BLUEPRINT_LIMITS.monthlyReport.subjectsCoveredMax
  );
  if (!subjectsCovered) throw new Error('Subjects covered is required.');

  return {
    studentName,
    gradeAndAge: clampString(
      input.gradeAndAge,
      BLUEPRINT_LIMITS.monthlyReport.gradeAndAgeMax
    ),
    monthKey,
    reportYear,
    reportMonth,
    reportingMonthLabel,
    subjectsCovered,
    completedClassesCount: Math.max(
      0,
      Math.min(200, Math.round(Number(input.completedClassesCount) || 0))
    ),
    approvedAiReportsCount: Math.max(
      0,
      Math.min(200, Math.round(Number(input.approvedAiReportsCount) || 0))
    ),
    totalInstructionMinutes: Math.max(
      0,
      Math.min(50000, Math.round(Number(input.totalInstructionMinutes) || 0))
    ),
    homeworkAssignedCount: Math.max(
      0,
      Math.min(200, Math.round(Number(input.homeworkAssignedCount) || 0))
    ),
    homeworkCompletedCount: Math.max(
      0,
      Math.min(200, Math.round(Number(input.homeworkCompletedCount) || 0))
    ),
    homeworkOutstandingCount: Math.max(
      0,
      Math.min(200, Math.round(Number(input.homeworkOutstandingCount) || 0))
    ),
    topicsCovered: clampString(
      input.topicsCovered,
      BLUEPRINT_LIMITS.monthlyReport.topicsCoveredMax
    ),
    skillsAndConceptsIntroduced: clampString(
      input.skillsAndConceptsIntroduced,
      BLUEPRINT_LIMITS.monthlyReport.skillsAndConceptsIntroducedMax
    ),
    practicalActivitiesAndProjects: clampString(
      input.practicalActivitiesAndProjects,
      BLUEPRINT_LIMITS.monthlyReport.practicalActivitiesAndProjectsMax
    ),
    learningObjectivesAchieved: clampString(
      input.learningObjectivesAchieved,
      BLUEPRINT_LIMITS.monthlyReport.learningObjectivesAchievedMax
    ),
    conceptUnderstanding: clampString(
      input.conceptUnderstanding,
      BLUEPRINT_LIMITS.monthlyReport.conceptUnderstandingMax
    ),
    applicationOfLearning: clampString(
      input.applicationOfLearning,
      BLUEPRINT_LIMITS.monthlyReport.applicationOfLearningMax
    ),
    participationAndEngagement: clampString(
      input.participationAndEngagement,
      BLUEPRINT_LIMITS.monthlyReport.participationAndEngagementMax
    ),
    areasOfStrength: clampString(
      input.areasOfStrength,
      BLUEPRINT_LIMITS.monthlyReport.areasOfStrengthMax
    ),
    areasRequiringDevelopment: clampString(
      input.areasRequiringDevelopment,
      BLUEPRINT_LIMITS.monthlyReport.areasRequiringDevelopmentMax
    ),
    subjectAssessments: sanitizeSubjectAssessments(input.subjectAssessments),
    homeworkAssignedSummary: clampString(
      input.homeworkAssignedSummary,
      BLUEPRINT_LIMITS.monthlyReport.homeworkAssignedSummaryMax
    ),
    homeworkCompletionStatus: clampString(
      input.homeworkCompletionStatus,
      BLUEPRINT_LIMITS.monthlyReport.homeworkCompletionStatusMax
    ),
    assessmentResultsAndFeedback: clampString(
      input.assessmentResultsAndFeedback,
      BLUEPRINT_LIMITS.monthlyReport.assessmentResultsAndFeedbackMax
    ),
    specificDifficultiesObserved: clampString(
      input.specificDifficultiesObserved,
      BLUEPRINT_LIMITS.monthlyReport.specificDifficultiesObservedMax
    ),
    conceptsNeedingRevision: clampString(
      input.conceptsNeedingRevision,
      BLUEPRINT_LIMITS.monthlyReport.conceptsNeedingRevisionMax
    ),
    skillsRequiringPractice: clampString(
      input.skillsRequiringPractice,
      BLUEPRINT_LIMITS.monthlyReport.skillsRequiringPracticeMax
    ),
    overallMonthlyAssessment: clampString(
      input.overallMonthlyAssessment,
      BLUEPRINT_LIMITS.monthlyReport.overallMonthlyAssessmentMax
    ),
    progressMadeDuringMonth: clampString(
      input.progressMadeDuringMonth,
      BLUEPRINT_LIMITS.monthlyReport.progressMadeDuringMonthMax
    ),
    recommendedTeachingApproachAndTargets: clampString(
      input.recommendedTeachingApproachAndTargets,
      BLUEPRINT_LIMITS.monthlyReport.recommendedTeachingApproachAndTargetsMax
    ),
    conclusion: clampString(input.conclusion, BLUEPRINT_LIMITS.monthlyReport.conclusionMax),
  };
}

export async function createMonthlyReport(
  teacherId: string,
  input: MonthlyReportDraft & { studentId: string; status: MonthlyReportStatus }
): Promise<string> {
  const fields = clampMonthlyDraftPayload(input);
  try {
    const payload: Record<string, unknown> = {
      teacherId,
      studentId: input.studentId,
      ...fields,
      status: input.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.status === MonthlyReportStatus.APPROVED) {
      payload.approvedAt = serverTimestamp();
    }
    const ref = await addDoc(collection(db, 'monthlyReports'), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'monthlyReports');
  }
}

export async function updateMonthlyReport(
  monthlyReportId: string,
  input: MonthlyReportDraft & { status: MonthlyReportStatus }
): Promise<void> {
  const fields = clampMonthlyDraftPayload(input);
  try {
    const payload: Record<string, unknown> = {
      ...fields,
      updatedAt: serverTimestamp(),
    };
    if (input.status === MonthlyReportStatus.APPROVED) {
      payload.status = MonthlyReportStatus.APPROVED;
      payload.approvedAt = serverTimestamp();
    }
    await updateDoc(doc(db, 'monthlyReports', monthlyReportId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `monthlyReports/${monthlyReportId}`);
  }
}

export async function deleteMonthlyReport(monthlyReportId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'monthlyReports', monthlyReportId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `monthlyReports/${monthlyReportId}`);
  }
}

// --- Integrations Hub CRUD (metadata & links only; never credentials) ---

export interface IntegrationInput {
  catalogId: string;
  isCustom: boolean;
  name: string;
  description?: string;
  category: IntegrationCategory;
  iconKey: string;
  accentColor: IntegrationAccentColor;
  websiteUrl?: string;
  loginUrl?: string;
  apiDocsUrl?: string;
  integrationMethod: IntegrationMethod;
  supportedMethods: IntegrationMethod[];
  status: IntegrationConnectionStatus;
  usageNotes?: string;
  permissionsSummary?: string;
  connectedAtIso?: string;
  lastSyncedAtIso?: string;
  pinnedToQuickLaunch?: boolean;
}

function assertOptionalIntegrationUrl(raw: string | undefined, label: string): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const safe = sanitizeHttpUrl(trimmed);
  if (!safe || safe.length < 8) {
    throw new Error(`${label} must start with https:// or http://`);
  }
  return safe.slice(0, BLUEPRINT_LIMITS.integration.urlMax);
}

function sanitizeSupportedMethods(
  list: IntegrationMethod[] | undefined,
  fallback: IntegrationMethod
): IntegrationMethod[] {
  const allowed = new Set<IntegrationMethod>(Object.values(IntegrationMethod));
  const cleaned = Array.from(
    new Set((list ?? []).filter((m) => allowed.has(m)))
  ).slice(0, BLUEPRINT_LIMITS.integration.maxSupportedMethods);
  return cleaned.length > 0 ? cleaned : [fallback];
}

export async function createIntegration(
  teacherId: string,
  input: IntegrationInput
): Promise<string> {
  const name = clampString(input.name, BLUEPRINT_LIMITS.integration.nameMax);
  if (!name) throw new Error('Application name is required.');

  const catalogId = clampString(
    input.catalogId || 'custom',
    BLUEPRINT_LIMITS.integration.catalogIdMax
  );
  if (!BLUEPRINT_LIMITS.integration.catalogIdPattern.test(catalogId)) {
    throw new Error('Invalid integration catalog identifier.');
  }

  const iconKey = clampString(
    input.iconKey || 'globe',
    BLUEPRINT_LIMITS.integration.iconKeyMax
  );
  if (!BLUEPRINT_LIMITS.integration.iconKeyPattern.test(iconKey)) {
    throw new Error('Invalid icon key.');
  }

  const websiteUrl = assertOptionalIntegrationUrl(input.websiteUrl, 'Website URL');
  const loginUrl = assertOptionalIntegrationUrl(input.loginUrl, 'Login or access URL');
  const apiDocsUrl = assertOptionalIntegrationUrl(
    input.apiDocsUrl,
    'API documentation URL'
  );

  if (
    input.integrationMethod === IntegrationMethod.DIRECT_LINK &&
    !websiteUrl &&
    !loginUrl
  ) {
    throw new Error('Please provide a Website URL or Login URL for a direct-link integration.');
  }

  const supportedMethods = sanitizeSupportedMethods(
    input.supportedMethods,
    input.integrationMethod
  );

  try {
    const ref = await addDoc(collection(db, 'integrations'), {
      teacherId,
      catalogId,
      isCustom: Boolean(input.isCustom),
      name,
      description: clampString(
        input.description,
        BLUEPRINT_LIMITS.integration.descriptionMax
      ),
      category: input.category,
      iconKey,
      accentColor: input.accentColor,
      websiteUrl,
      loginUrl,
      apiDocsUrl,
      integrationMethod: input.integrationMethod,
      supportedMethods,
      status: input.status,
      usageNotes: clampString(
        input.usageNotes,
        BLUEPRINT_LIMITS.integration.usageNotesMax
      ),
      permissionsSummary: clampString(
        input.permissionsSummary,
        BLUEPRINT_LIMITS.integration.permissionsSummaryMax
      ),
      connectedAtIso: clampString(
        input.connectedAtIso ??
          (input.status === IntegrationConnectionStatus.CONNECTED
            ? new Date().toISOString()
            : ''),
        BLUEPRINT_LIMITS.integration.isoTimestampMax
      ),
      lastSyncedAtIso: clampString(
        input.lastSyncedAtIso,
        BLUEPRINT_LIMITS.integration.isoTimestampMax
      ),
      pinnedToQuickLaunch: Boolean(input.pinnedToQuickLaunch),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'integrations');
  }
}

export async function updateIntegration(
  integrationId: string,
  input: Partial<Omit<IntegrationInput, 'catalogId' | 'isCustom'>>
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.name !== undefined) {
    const name = clampString(input.name, BLUEPRINT_LIMITS.integration.nameMax);
    if (!name) throw new Error('Application name is required.');
    payload.name = name;
  }
  if (input.description !== undefined) {
    payload.description = clampString(
      input.description,
      BLUEPRINT_LIMITS.integration.descriptionMax
    );
  }
  if (input.category !== undefined) payload.category = input.category;
  if (input.iconKey !== undefined) {
    const iconKey = clampString(
      input.iconKey,
      BLUEPRINT_LIMITS.integration.iconKeyMax
    );
    if (BLUEPRINT_LIMITS.integration.iconKeyPattern.test(iconKey)) {
      payload.iconKey = iconKey;
    }
  }
  if (input.accentColor !== undefined) payload.accentColor = input.accentColor;
  if (input.websiteUrl !== undefined) {
    payload.websiteUrl = assertOptionalIntegrationUrl(input.websiteUrl, 'Website URL');
  }
  if (input.loginUrl !== undefined) {
    payload.loginUrl = assertOptionalIntegrationUrl(
      input.loginUrl,
      'Login or access URL'
    );
  }
  if (input.apiDocsUrl !== undefined) {
    payload.apiDocsUrl = assertOptionalIntegrationUrl(
      input.apiDocsUrl,
      'API documentation URL'
    );
  }
  if (input.integrationMethod !== undefined) {
    payload.integrationMethod = input.integrationMethod;
  }
  if (input.supportedMethods !== undefined) {
    payload.supportedMethods = sanitizeSupportedMethods(
      input.supportedMethods,
      input.integrationMethod ?? IntegrationMethod.DIRECT_LINK
    );
  }
  if (input.status !== undefined) payload.status = input.status;
  if (input.usageNotes !== undefined) {
    payload.usageNotes = clampString(
      input.usageNotes,
      BLUEPRINT_LIMITS.integration.usageNotesMax
    );
  }
  if (input.permissionsSummary !== undefined) {
    payload.permissionsSummary = clampString(
      input.permissionsSummary,
      BLUEPRINT_LIMITS.integration.permissionsSummaryMax
    );
  }
  if (input.connectedAtIso !== undefined) {
    payload.connectedAtIso = clampString(
      input.connectedAtIso,
      BLUEPRINT_LIMITS.integration.isoTimestampMax
    );
  }
  if (input.lastSyncedAtIso !== undefined) {
    payload.lastSyncedAtIso = clampString(
      input.lastSyncedAtIso,
      BLUEPRINT_LIMITS.integration.isoTimestampMax
    );
  }
  if (input.pinnedToQuickLaunch !== undefined) {
    payload.pinnedToQuickLaunch = Boolean(input.pinnedToQuickLaunch);
  }

  try {
    await updateDoc(doc(db, 'integrations', integrationId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `integrations/${integrationId}`);
  }
}

export async function deleteIntegration(integrationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'integrations', integrationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `integrations/${integrationId}`);
  }
}
