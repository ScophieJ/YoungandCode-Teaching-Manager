import type { Timestamp } from 'firebase/firestore';

export enum Subject {
  MATHEMATICS = 'Mathematics',
  TECHNOLOGY = 'Technology',
}

export enum StudentStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum LessonPlanStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  UPCOMING = 'upcoming',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export function isScheduledLessonStatus(status: LessonPlanStatus): boolean {
  return status === LessonPlanStatus.SCHEDULED || status === LessonPlanStatus.UPCOMING;
}

export function formatLessonStatusLabel(status: LessonPlanStatus): string {
  switch (status) {
    case LessonPlanStatus.DRAFT:
      return 'Draft';
    case LessonPlanStatus.SCHEDULED:
    case LessonPlanStatus.UPCOMING:
      return 'Scheduled';
    case LessonPlanStatus.COMPLETED:
      return 'Completed';
    case LessonPlanStatus.CANCELLED:
      return 'Cancelled';
    default:
      return status;
  }
}

export enum ClassReportStatus {
  IN_PROGRESS = 'in_progress',
  DRAFT = 'draft',
  COMPLETED = 'completed',
}

export function formatClassStatusLabel(status: ClassReportStatus): string {
  switch (status) {
    case ClassReportStatus.IN_PROGRESS:
      return 'In Progress';
    case ClassReportStatus.DRAFT:
      return 'Draft';
    case ClassReportStatus.COMPLETED:
      return 'Completed';
    default:
      return status;
  }
}

export enum UnderstandingLevel {
  DEVELOPING = 'developing',
  STEADY = 'steady',
  STRONG = 'strong',
  MASTERED = 'mastered',
}

export enum HomeworkStatus {
  ASSIGNED = 'assigned',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
  // Legacy values preserved for backwards compatibility with existing Firestore records
  PENDING = 'pending',
  REVIEWED = 'reviewed',
}

export type CanonicalHomeworkStatus =
  | 'assigned'
  | 'submitted'
  | 'under_review'
  | 'completed'
  | 'overdue';

export enum HomeworkLinkKind {
  GOOGLE_DOC = 'google_doc',
  MIRO = 'miro',
  YOUTUBE = 'youtube',
  WORKSHEET = 'worksheet',
  OTHER = 'other',
}

export interface HomeworkLink {
  title: string;
  url: string;
  kind: HomeworkLinkKind;
}

export function localTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getEffectiveHomeworkStatus(
  item: { status: HomeworkStatus | string; dueDate?: string },
  referenceDate: string = localTodayIso()
): CanonicalHomeworkStatus {
  switch (item.status) {
    case HomeworkStatus.COMPLETED:
    case HomeworkStatus.REVIEWED:
      return 'completed';
    case HomeworkStatus.UNDER_REVIEW:
      return 'under_review';
    case HomeworkStatus.SUBMITTED:
      return 'submitted';
    case HomeworkStatus.OVERDUE:
      return 'overdue';
    case HomeworkStatus.ASSIGNED:
    case HomeworkStatus.PENDING:
    default:
      if (item.dueDate && item.dueDate < referenceDate) {
        return 'overdue';
      }
      return 'assigned';
  }
}

export function isHomeworkCompleted(item: {
  status: HomeworkStatus | string;
}): boolean {
  return (
    item.status === HomeworkStatus.COMPLETED ||
    item.status === HomeworkStatus.REVIEWED
  );
}

export function formatHomeworkStatusLabel(
  status: CanonicalHomeworkStatus | HomeworkStatus | string
): string {
  switch (status) {
    case HomeworkStatus.ASSIGNED:
    case HomeworkStatus.PENDING:
      return 'Assigned';
    case HomeworkStatus.SUBMITTED:
      return 'Submitted';
    case HomeworkStatus.UNDER_REVIEW:
      return 'Under Review';
    case HomeworkStatus.COMPLETED:
    case HomeworkStatus.REVIEWED:
      return 'Completed';
    case HomeworkStatus.OVERDUE:
      return 'Overdue';
    default:
      return String(status);
  }
}

export function detectHomeworkLinkKind(url: string): HomeworkLinkKind {
  const lower = url.trim().toLowerCase();
  if (lower.includes('docs.google.com') || lower.includes('drive.google.com')) {
    return HomeworkLinkKind.GOOGLE_DOC;
  }
  if (lower.includes('miro.com')) {
    return HomeworkLinkKind.MIRO;
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return HomeworkLinkKind.YOUTUBE;
  }
  return HomeworkLinkKind.OTHER;
}

export function formatHomeworkLinkKindLabel(kind: HomeworkLinkKind | string): string {
  switch (kind) {
    case HomeworkLinkKind.GOOGLE_DOC:
      return 'Google Doc';
    case HomeworkLinkKind.MIRO:
      return 'Miro Board';
    case HomeworkLinkKind.YOUTUBE:
      return 'YouTube Video';
    case HomeworkLinkKind.WORKSHEET:
      return 'Worksheet';
    case HomeworkLinkKind.OTHER:
    default:
      return 'External Link';
  }
}

export enum ResourceType {
  WORKSHEET = 'worksheet',
  LINK = 'link',
  GUIDE = 'guide',
  EXERCISE = 'exercise',
}

export enum MonthlyReportStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
}

export enum IntegrationCategory {
  VIDEO_CONFERENCING = 'video_conferencing',
  LMS = 'lms',
  AI_TOOLS = 'ai_tools',
  DOCUMENTS_STORAGE = 'documents_storage',
  MATH_WHITEBOARDS = 'math_whiteboards',
  CODING_TOOLS = 'coding_tools',
  DESIGN_CREATIVITY = 'design_creativity',
  COMMUNICATION = 'communication',
  ASSESSMENT_QUIZZES = 'assessment_quizzes',
  FILE_SHARING = 'file_sharing',
  PRODUCTIVITY_SCHEDULING = 'productivity_scheduling',
  OTHER = 'other',
}

export enum IntegrationMethod {
  DIRECT_LINK = 'direct_link',
  OAUTH = 'oauth',
  API = 'api',
  WEBHOOK = 'webhook',
  CUSTOM = 'custom',
}

export enum IntegrationConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONFIGURATION_REQUIRED = 'configuration_required',
}

export type IntegrationAccentColor =
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'emerald'
  | 'orange'
  | 'amber'
  | 'rose'
  | 'slate';

export type NavTab =
  | 'dashboard'
  | 'students'
  | 'lesson-plans'
  | 'class-sessions'
  | 'homework'
  | 'monthly-reports'
  | 'integrations';

export interface TeacherProfile {
  uid: string;
  displayName: string;
  email: string;
  seededDefaults: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Student {
  id: string;
  teacherId: string;
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
  status: StudentStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LessonPlan {
  id: string;
  teacherId: string;
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
  status: LessonPlanStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClassReport {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  subject: Subject;
  lessonPlanId?: string;
  topic: string;
  sessionDate: string;
  durationMinutes: number;
  startedAtIso?: string;
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
  understandingLevel: UnderstandingLevel;
  status: ClassReportStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface AiReportDraft {
  studentName: string;
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
}

export interface ApprovedAiReport extends AiReportDraft {
  id: string;
  teacherId: string;
  studentId: string;
  classReportId: string;
  sessionDate: string;
  status: 'approved';
  approvedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Homework {
  id: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  subject: Subject;
  title: string;
  instructions?: string;
  questionsOrTasks?: string;
  assignedDate?: string;
  dueDate: string;
  status: HomeworkStatus;
  supportingLinks?: HomeworkLink[];
  lessonPlanId?: string;
  classReportId?: string;
  submittedDate?: string;
  studentWorkSummary?: string;
  submissionLinks?: HomeworkLink[];
  score?: string;
  feedback?: string;
  areasForImprovement?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudentResource {
  id: string;
  teacherId: string;
  studentId: string;
  subject: Subject;
  title: string;
  resourceType: ResourceType;
  url?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MonthlySubjectAssessment {
  subject: Subject;
  classesCompletedCount: number;
  criteriaFocus: string;
  coverageSummary: string;
  performanceAssessment: string;
  nextSubjectFocus: string;
}

export interface MonthlyReportDraft {
  studentName: string;
  gradeAndAge: string;
  monthKey: string;
  reportYear: number;
  reportMonth: number;
  reportingMonthLabel: string;
  subjectsCovered: string;
  completedClassesCount: number;
  approvedAiReportsCount: number;
  totalInstructionMinutes: number;
  homeworkAssignedCount: number;
  homeworkCompletedCount: number;
  homeworkOutstandingCount: number;
  topicsCovered: string;
  skillsAndConceptsIntroduced: string;
  practicalActivitiesAndProjects: string;
  learningObjectivesAchieved: string;
  conceptUnderstanding: string;
  applicationOfLearning: string;
  participationAndEngagement: string;
  areasOfStrength: string;
  areasRequiringDevelopment: string;
  subjectAssessments: MonthlySubjectAssessment[];
  homeworkAssignedSummary: string;
  homeworkCompletionStatus: string;
  assessmentResultsAndFeedback: string;
  specificDifficultiesObserved: string;
  conceptsNeedingRevision: string;
  skillsRequiringPractice: string;
  overallMonthlyAssessment: string;
  progressMadeDuringMonth: string;
  recommendedTeachingApproachAndTargets: string;
  conclusion: string;
}

export interface MonthlyReport extends MonthlyReportDraft {
  id: string;
  teacherId: string;
  studentId: string;
  status: MonthlyReportStatus;
  approvedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface TeacherIntegration {
  id: string;
  teacherId: string;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Validation limits synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  datePattern: /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
  idPattern: /^[a-zA-Z0-9_\-]+$/,
  student: {
    fullNameMax: 120,
    ageMax: 20,
    gradeMax: 60,
    schoolMax: 160,
    ageGroupMax: 60,
    guardianNameMax: 120,
    teachingNotesMax: 2000,
    learningGoalsMax: 1500,
    progressSummaryMax: 2000,
    levelMax: 120,
  },
  lessonPlan: {
    topicMax: 200,
    scheduledTimeMax: 20,
    durationMin: 5,
    durationMax: 480,
    learningObjectivesMax: 2000,
    previousKnowledgeMax: 2000,
    lessonIntroductionMax: 2500,
    teachingMaterialsMax: 2000,
    activitiesMax: 4000,
    practicalExercisesMax: 2500,
    classworkMax: 2000,
    homeworkMax: 2000,
    expectedOutcomesMax: 2000,
  },
  classReport: {
    topicMax: 200,
    durationMax: 480,
    objectivesCoveredMax: 2500,
    conceptsTaughtMax: 3000,
    activitiesCompletedMax: 3500,
    practicalExercisesPerformedMax: 2500,
    classworkGivenMax: 2500,
    studentParticipationMax: 2500,
    understoodWellMax: 2500,
    struggledWithMax: 2500,
    challengesEncounteredMax: 2500,
    homeworkAssignedMax: 2500,
    teacherObservationsMax: 3000,
    recommendationsNextFocusMax: 2500,
    notesMax: 5000,
    progressNotesMax: 2000,
  },
  aiReport: {
    studentNameMax: 120,
    lessonTopicMax: 200,
    dateAndDurationMax: 120,
    learningObjectivesCoveredMax: 3000,
    conceptsTaughtMax: 3500,
    activitiesAndExercisesCompletedMax: 4500,
    studentParticipationMax: 3000,
    demonstratedUnderstandingMax: 3000,
    areasRequiringImprovementMax: 3000,
    challengesEncounteredMax: 3000,
    homeworkAssignedMax: 3000,
    teacherObservationsMax: 3500,
    recommendedNextStepsMax: 3000,
  },
  homework: {
    titleMax: 200,
    instructionsMax: 3000,
    questionsOrTasksMax: 4000,
    maxLinks: 10,
    linkTitleMax: 160,
    linkUrlMax: 500,
    studentWorkSummaryMax: 4000,
    scoreMax: 80,
    feedbackMax: 2500,
    areasForImprovementMax: 2000,
  },
  resource: {
    titleMax: 200,
    urlMax: 500,
    notesMax: 1000,
  },
  monthlyReport: {
    studentNameMax: 120,
    gradeAndAgeMax: 160,
    monthKeyPattern: /^[0-9]{4}-[0-9]{2}$/,
    reportingMonthLabelMax: 40,
    subjectsCoveredMax: 120,
    topicsCoveredMax: 3500,
    skillsAndConceptsIntroducedMax: 3500,
    practicalActivitiesAndProjectsMax: 4000,
    learningObjectivesAchievedMax: 3500,
    conceptUnderstandingMax: 3500,
    applicationOfLearningMax: 3500,
    participationAndEngagementMax: 3000,
    areasOfStrengthMax: 3500,
    areasRequiringDevelopmentMax: 3500,
    maxSubjectAssessments: 2,
    subjectCriteriaFocusMax: 500,
    subjectCoverageSummaryMax: 2500,
    subjectPerformanceAssessmentMax: 2500,
    subjectNextFocusMax: 2000,
    homeworkAssignedSummaryMax: 3500,
    homeworkCompletionStatusMax: 3500,
    assessmentResultsAndFeedbackMax: 3500,
    specificDifficultiesObservedMax: 3500,
    conceptsNeedingRevisionMax: 3000,
    skillsRequiringPracticeMax: 3000,
    overallMonthlyAssessmentMax: 3500,
    progressMadeDuringMonthMax: 3500,
    recommendedTeachingApproachAndTargetsMax: 3500,
    conclusionMax: 3000,
  },
  integration: {
    catalogIdMax: 80,
    catalogIdPattern: /^[a-zA-Z0-9_\-]+$/,
    nameMax: 120,
    descriptionMax: 600,
    iconKeyMax: 40,
    iconKeyPattern: /^[a-z0-9_\-]+$/,
    urlMax: 500,
    usageNotesMax: 1500,
    permissionsSummaryMax: 500,
    isoTimestampMax: 40,
    maxSupportedMethods: 5,
  },
} as const;
