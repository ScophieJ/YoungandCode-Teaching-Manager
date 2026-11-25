import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';
import { AiGenerationError } from './aiReportGenerator.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

export interface MonthlyReportSourcePayload {
  student: {
    id: string;
    fullName: string;
    age: string;
    grade: string;
    gradeAndAge: string;
    school: string;
    subjects: Array<'Mathematics' | 'Technology'>;
    mathLevel: string;
    techLevel: string;
    learningGoals: string;
    teachingNotes: string;
  };
  monthKey: string;
  reportYear: number;
  reportMonth: number;
  reportingMonthLabel: string;
  subjectsCoveredList: Array<'Mathematics' | 'Technology'>;
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
  completedClasses: Array<{
    id: string;
    sessionDate: string;
    durationMinutes: number;
    subject: 'Mathematics' | 'Technology';
    topic: string;
    understandingLevel: string;
    plannedObjectives?: string;
    plannedOutcomes?: string;
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
    approvedAiReport?: {
      id: string;
      learningObjectivesCovered?: string;
      conceptsTaught?: string;
      activitiesAndExercisesCompleted?: string;
      studentParticipation?: string;
      demonstratedUnderstanding?: string;
      areasRequiringImprovement?: string;
      challengesEncountered?: string;
      homeworkAssigned?: string;
      teacherObservations?: string;
      recommendedNextSteps?: string;
    };
  }>;
  standaloneApprovedAiReports: Array<{
    id: string;
    sessionDate: string;
    subject: 'Mathematics' | 'Technology';
    lessonTopic: string;
    dateAndDuration: string;
    learningObjectivesCovered?: string;
    conceptsTaught?: string;
    activitiesAndExercisesCompleted?: string;
    studentParticipation?: string;
    demonstratedUnderstanding?: string;
    areasRequiringImprovement?: string;
    challengesEncountered?: string;
    homeworkAssigned?: string;
    teacherObservations?: string;
    recommendedNextSteps?: string;
  }>;
  uncompletedPlannedLessons: Array<{
    id: string;
    subject: 'Mathematics' | 'Technology';
    topic: string;
    scheduledDate: string;
    status: string;
    learningObjectives?: string;
  }>;
  homeworkRecords: Array<{
    id: string;
    subject: 'Mathematics' | 'Technology';
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
  }>;
}

export interface GeneratedMonthlySubjectAssessment {
  subject: 'Mathematics' | 'Technology';
  classesCompletedCount: number;
  criteriaFocus: string;
  coverageSummary: string;
  performanceAssessment: string;
  nextSubjectFocus: string;
}

export interface GeneratedMonthlyReportPayload {
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
  subjectAssessments: GeneratedMonthlySubjectAssessment[];
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

const LIMITS = {
  studentName: 120,
  gradeAndAge: 160,
  reportingMonthLabel: 40,
  subjectsCovered: 120,
  topicsCovered: 3500,
  skillsAndConceptsIntroduced: 3500,
  practicalActivitiesAndProjects: 4000,
  learningObjectivesAchieved: 3500,
  conceptUnderstanding: 3500,
  applicationOfLearning: 3500,
  participationAndEngagement: 3000,
  areasOfStrength: 3500,
  areasRequiringDevelopment: 3500,
  subjectCriteriaFocus: 500,
  subjectCoverageSummary: 2500,
  subjectPerformanceAssessment: 2500,
  subjectNextFocus: 2000,
  homeworkAssignedSummary: 3500,
  homeworkCompletionStatus: 3500,
  assessmentResultsAndFeedback: 3500,
  specificDifficultiesObserved: 3500,
  conceptsNeedingRevision: 3000,
  skillsRequiringPractice: 3000,
  overallMonthlyAssessment: 3500,
  progressMadeDuringMonth: 3500,
  recommendedTeachingApproachAndTargets: 3500,
  conclusion: 3000,
} as const;

function clamp(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

const SYSTEM_INSTRUCTION = [
  'You are an experienced private Mathematics and Technology educator writing formal YoungAndCode Monthly Academic Progress Reports for a single student.',
  'You must analyze ONLY the saved monthly academic records provided in JSON.',
  'Mandatory accuracy and pedagogy rules:',
  '1. Base every statement strictly on actual saved records (completed class documentation, approved AI class reports attached to those classes, homework assignments/assessments, and student profile age/grade).',
  '2. NEVER treat uncompletedPlannedLessons (draft/scheduled/upcoming plans) as completed classes. Cancelled lessons are already excluded and must never be mentioned as completed.',
  '3. Identify developmental progress and patterns ACROSS multiple lessons in the month rather than merely copying single-class summaries.',
  '4. Explicitly distinguish between concepts INTRODUCED (first exposed), concepts PRACTICED (guided drills/exercises), and skills DEMONSTRATED independently.',
  '5. NEVER claim mastery without explicit supporting evidence in the saved records (e.g., understandingLevel "mastered" or documented independent success).',
  '6. NEVER invent attendance dates, test scores, grades, projects, homework completion, or student responses.',
  '7. Clearly identify missing or unrecorded information (for example, when assessment scores, age/grade, or homework feedback were not recorded).',
  '8. Avoid generic praise ("brilliant student", "amazing progress") and repetitive filler across sections. Write in clear, natural, professional English.',
  '9. Apply age-appropriate expectations using the student age and grade provided (e.g., evaluate an early-years age 5 learner by age-appropriate foundational curiosity, guided recognition, and step-by-step readiness—never compare younger students against older grade levels).',
  '10. Adapt evaluation criteria by subject and populate subjectAssessments separately for EACH subject in subjectsCoveredList:',
  '    - Mathematics criteria: conceptual reasoning, procedural/calculation accuracy, step-by-step problem solving, and ability to explain steps.',
  '    - Technology criteria: hands-on digital/coding execution, logical & computational thinking, debugging/troubleshooting resilience, and practical project application.',
  '    Never evaluate Mathematics and Technology with identical generic criteria.',
  '11. If completedClasses is empty (0 completed classes), clearly state in the sections that no completed class sessions were documented for this reporting month, summarize only actual recorded homework if any exists, and do NOT invent any class sessions.',
].join('\n');

async function callGeminiWithRetry(
  ai: GoogleGenAI,
  userPrompt: string
): Promise<GenerateContentResponse> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL_NAME,
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topicsCovered: { type: Type.STRING },
              skillsAndConceptsIntroduced: { type: Type.STRING },
              practicalActivitiesAndProjects: { type: Type.STRING },
              learningObjectivesAchieved: { type: Type.STRING },
              conceptUnderstanding: { type: Type.STRING },
              applicationOfLearning: { type: Type.STRING },
              participationAndEngagement: { type: Type.STRING },
              areasOfStrength: { type: Type.STRING },
              areasRequiringDevelopment: { type: Type.STRING },
              subjectAssessments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    criteriaFocus: { type: Type.STRING },
                    coverageSummary: { type: Type.STRING },
                    performanceAssessment: { type: Type.STRING },
                    nextSubjectFocus: { type: Type.STRING },
                  },
                  required: [
                    'subject',
                    'criteriaFocus',
                    'coverageSummary',
                    'performanceAssessment',
                    'nextSubjectFocus',
                  ],
                },
              },
              homeworkAssignedSummary: { type: Type.STRING },
              homeworkCompletionStatus: { type: Type.STRING },
              assessmentResultsAndFeedback: { type: Type.STRING },
              specificDifficultiesObserved: { type: Type.STRING },
              conceptsNeedingRevision: { type: Type.STRING },
              skillsRequiringPractice: { type: Type.STRING },
              overallMonthlyAssessment: { type: Type.STRING },
              progressMadeDuringMonth: { type: Type.STRING },
              recommendedTeachingApproachAndTargets: { type: Type.STRING },
              conclusion: { type: Type.STRING },
            },
            required: [
              'topicsCovered',
              'skillsAndConceptsIntroduced',
              'practicalActivitiesAndProjects',
              'learningObjectivesAchieved',
              'conceptUnderstanding',
              'applicationOfLearning',
              'participationAndEngagement',
              'areasOfStrength',
              'areasRequiringDevelopment',
              'subjectAssessments',
              'homeworkAssignedSummary',
              'homeworkCompletionStatus',
              'assessmentResultsAndFeedback',
              'specificDifficultiesObserved',
              'conceptsNeedingRevision',
              'skillsRequiringPractice',
              'overallMonthlyAssessment',
              'progressMadeDuringMonth',
              'recommendedTeachingApproachAndTargets',
              'conclusion',
            ],
          },
        },
      });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('429') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNRESET');

      if (!isTransient || attempt === maxAttempts) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }

  throw lastError;
}

function defaultCriteriaForSubject(subject: 'Mathematics' | 'Technology'): string {
  if (subject === 'Mathematics') {
    return 'Conceptual reasoning, numerical/procedural accuracy, structured problem solving, and step explanation.';
  }
  return 'Hands-on digital execution, logical & computational thinking, debugging resilience, and practical project application.';
}

export async function generateStructuredMonthlyReport(
  source: MonthlyReportSourcePayload
): Promise<GeneratedMonthlyReportPayload> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiGenerationError(
      'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.',
      503
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Sanitize source payload sent to Gemini to keep prompt clean and bounded
  const boundedSource = {
    student: {
      fullName: clamp(source.student.fullName, 120),
      age: clamp(source.student.age, 20),
      grade: clamp(source.student.grade, 60),
      gradeAndAge: clamp(source.student.gradeAndAge, 160),
      subjects: source.student.subjects,
      mathLevel: clamp(source.student.mathLevel, 120),
      techLevel: clamp(source.student.techLevel, 120),
      learningGoals: clamp(source.student.learningGoals, 1500),
      teachingNotes: clamp(source.student.teachingNotes, 1500),
    },
    reportingMonthLabel: source.reportingMonthLabel,
    monthKey: source.monthKey,
    subjectsCoveredList: source.subjectsCoveredList,
    stats: source.stats,
    completedClasses: source.completedClasses.slice(0, 40).map((c) => ({
      sessionDate: c.sessionDate,
      durationMinutes: c.durationMinutes,
      subject: c.subject,
      topic: clamp(c.topic, 200),
      understandingLevel: c.understandingLevel,
      plannedObjectives: clamp(c.plannedObjectives, 800),
      objectivesCovered: clamp(c.objectivesCovered, 1200),
      conceptsTaught: clamp(c.conceptsTaught, 1500),
      activitiesCompleted: clamp(c.activitiesCompleted, 1500),
      practicalExercisesPerformed: clamp(c.practicalExercisesPerformed, 1200),
      classworkGiven: clamp(c.classworkGiven, 1200),
      studentParticipation: clamp(c.studentParticipation, 1200),
      understoodWell: clamp(c.understoodWell, 1200),
      struggledWith: clamp(c.struggledWith, 1200),
      challengesEncountered: clamp(c.challengesEncountered, 1200),
      homeworkAssigned: clamp(c.homeworkAssigned, 1000),
      teacherObservations: clamp(c.teacherObservations, 1500),
      recommendationsNextFocus: clamp(c.recommendationsNextFocus, 1200),
      notes: clamp(c.notes, 1500),
      progressNotes: clamp(c.progressNotes, 1000),
      approvedAiReportSummary: c.approvedAiReport
        ? {
            demonstratedUnderstanding: clamp(c.approvedAiReport.demonstratedUnderstanding, 1200),
            areasRequiringImprovement: clamp(c.approvedAiReport.areasRequiringImprovement, 1200),
            recommendedNextSteps: clamp(c.approvedAiReport.recommendedNextSteps, 1000),
          }
        : undefined,
    })),
    standaloneApprovedAiReports: source.standaloneApprovedAiReports.slice(0, 20),
    uncompletedPlannedLessonsNote:
      source.uncompletedPlannedLessons.length > 0
        ? source.uncompletedPlannedLessons.map((p) => ({
            scheduledDate: p.scheduledDate,
            subject: p.subject,
            topic: clamp(p.topic, 200),
            status: p.status,
          }))
        : [],
    homeworkRecords: source.homeworkRecords.slice(0, 40).map((h) => ({
      subject: h.subject,
      title: clamp(h.title, 200),
      assignedDate: h.assignedDate,
      dueDate: h.dueDate,
      submittedDate: h.submittedDate,
      status: h.statusLabel,
      score: clamp(h.score, 80),
      feedback: clamp(h.feedback, 1200),
      areasForImprovement: clamp(h.areasForImprovement, 1000),
      studentWorkSummary: clamp(h.studentWorkSummary, 1000),
    })),
  };

  const userPrompt = [
    `Generate the Monthly Academic Progress Report for ${boundedSource.student.fullName} covering ${boundedSource.reportingMonthLabel}.`,
    'Compile across ALL documented completed classes and homework records below without duplicating lessons or fabricating details.',
    '',
    JSON.stringify(boundedSource, null, 2),
  ].join('\n');

  let response: GenerateContentResponse;
  try {
    response = await callGeminiWithRetry(ai, userPrompt);
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    if (
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('403')
    ) {
      throw new AiGenerationError(
        'Gemini API access was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.',
        502
      );
    }
    if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
      throw new AiGenerationError(
        'Gemini API rate limit or quota reached. Please wait a moment and try again.',
        429
      );
    }
    throw new AiGenerationError(
      'Unable to generate monthly report with Gemini AI right now. Please try again.',
      502
    );
  }

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new AiGenerationError(
      'Gemini returned an empty response. Please try regenerating the monthly report.',
      502
    );
  }

  let parsed: Partial<GeneratedMonthlyReportPayload>;
  try {
    parsed = JSON.parse(rawText) as Partial<GeneratedMonthlyReportPayload>;
  } catch {
    throw new AiGenerationError(
      'Gemini returned an unreadable monthly report format. Please try regenerating.',
      502
    );
  }

  const missingFallback =
    source.stats.completedClassesCount === 0
      ? `No completed class sessions were documented for ${source.student.fullName} in ${source.reportingMonthLabel}.`
      : 'Not recorded in the saved documentation for this reporting period.';

  // Ensure subjectAssessments strictly aligns 1:1 with subjectsCoveredList (max 2)
  const aiSubjectMap = new Map<string, Partial<GeneratedMonthlySubjectAssessment>>();
  if (Array.isArray(parsed.subjectAssessments)) {
    for (const item of parsed.subjectAssessments) {
      if (item && (item.subject === 'Mathematics' || item.subject === 'Technology')) {
        aiSubjectMap.set(item.subject, item);
      }
    }
  }

  const subjectAssessments: GeneratedMonthlySubjectAssessment[] = source.subjectsCoveredList
    .slice(0, 2)
    .map((subj) => {
      const classesForSubject = source.completedClasses.filter(
        (c) => c.subject === subj
      ).length;
      const aiItem = aiSubjectMap.get(subj);
      return {
        subject: subj,
        classesCompletedCount: classesForSubject,
        criteriaFocus:
          clamp(aiItem?.criteriaFocus, LIMITS.subjectCriteriaFocus) ||
          defaultCriteriaForSubject(subj),
        coverageSummary:
          clamp(aiItem?.coverageSummary, LIMITS.subjectCoverageSummary) ||
          (classesForSubject === 0
            ? `No completed ${subj} classes were recorded in ${source.reportingMonthLabel}.`
            : missingFallback),
        performanceAssessment:
          clamp(aiItem?.performanceAssessment, LIMITS.subjectPerformanceAssessment) ||
          (classesForSubject === 0
            ? `No completed ${subj} class observations recorded for performance evaluation this month.`
            : missingFallback),
        nextSubjectFocus:
          clamp(aiItem?.nextSubjectFocus, LIMITS.subjectNextFocus) ||
          'Not recorded in the saved documentation for this reporting period.',
      };
    });

  return {
    studentName: clamp(source.student.fullName, LIMITS.studentName),
    gradeAndAge: clamp(source.student.gradeAndAge, LIMITS.gradeAndAge) || 'Not recorded',
    monthKey: source.monthKey,
    reportYear: source.reportYear,
    reportMonth: source.reportMonth,
    reportingMonthLabel: clamp(source.reportingMonthLabel, LIMITS.reportingMonthLabel),
    subjectsCovered: clamp(source.subjectsCoveredText, LIMITS.subjectsCovered),
    completedClassesCount: Math.max(0, Math.min(200, source.stats.completedClassesCount)),
    approvedAiReportsCount: Math.max(0, Math.min(200, source.stats.approvedAiReportsCount)),
    totalInstructionMinutes: Math.max(
      0,
      Math.min(50000, source.stats.totalInstructionMinutes)
    ),
    homeworkAssignedCount: Math.max(0, Math.min(200, source.stats.homeworkAssignedCount)),
    homeworkCompletedCount: Math.max(0, Math.min(200, source.stats.homeworkCompletedCount)),
    homeworkOutstandingCount: Math.max(0, Math.min(200, source.stats.homeworkOutstandingCount)),
    topicsCovered: clamp(parsed.topicsCovered, LIMITS.topicsCovered) || missingFallback,
    skillsAndConceptsIntroduced:
      clamp(parsed.skillsAndConceptsIntroduced, LIMITS.skillsAndConceptsIntroduced) ||
      missingFallback,
    practicalActivitiesAndProjects:
      clamp(parsed.practicalActivitiesAndProjects, LIMITS.practicalActivitiesAndProjects) ||
      missingFallback,
    learningObjectivesAchieved:
      clamp(parsed.learningObjectivesAchieved, LIMITS.learningObjectivesAchieved) ||
      missingFallback,
    conceptUnderstanding:
      clamp(parsed.conceptUnderstanding, LIMITS.conceptUnderstanding) || missingFallback,
    applicationOfLearning:
      clamp(parsed.applicationOfLearning, LIMITS.applicationOfLearning) || missingFallback,
    participationAndEngagement:
      clamp(parsed.participationAndEngagement, LIMITS.participationAndEngagement) ||
      missingFallback,
    areasOfStrength: clamp(parsed.areasOfStrength, LIMITS.areasOfStrength) || missingFallback,
    areasRequiringDevelopment:
      clamp(parsed.areasRequiringDevelopment, LIMITS.areasRequiringDevelopment) ||
      missingFallback,
    subjectAssessments,
    homeworkAssignedSummary:
      clamp(parsed.homeworkAssignedSummary, LIMITS.homeworkAssignedSummary) ||
      (source.stats.homeworkAssignedCount === 0
        ? `No homework assignments were recorded for ${source.student.fullName} in ${source.reportingMonthLabel}.`
        : missingFallback),
    homeworkCompletionStatus:
      clamp(parsed.homeworkCompletionStatus, LIMITS.homeworkCompletionStatus) ||
      (source.stats.homeworkAssignedCount === 0
        ? 'No homework completion records for this period.'
        : `${source.stats.homeworkCompletedCount} of ${source.stats.homeworkAssignedCount} assigned homework tasks completed (${source.stats.homeworkOutstandingCount} outstanding).`),
    assessmentResultsAndFeedback:
      clamp(parsed.assessmentResultsAndFeedback, LIMITS.assessmentResultsAndFeedback) ||
      'No assessment scores or written homework feedback were recorded for this period.',
    specificDifficultiesObserved:
      clamp(parsed.specificDifficultiesObserved, LIMITS.specificDifficultiesObserved) ||
      missingFallback,
    conceptsNeedingRevision:
      clamp(parsed.conceptsNeedingRevision, LIMITS.conceptsNeedingRevision) || missingFallback,
    skillsRequiringPractice:
      clamp(parsed.skillsRequiringPractice, LIMITS.skillsRequiringPractice) || missingFallback,
    overallMonthlyAssessment:
      clamp(parsed.overallMonthlyAssessment, LIMITS.overallMonthlyAssessment) ||
      missingFallback,
    progressMadeDuringMonth:
      clamp(parsed.progressMadeDuringMonth, LIMITS.progressMadeDuringMonth) || missingFallback,
    recommendedTeachingApproachAndTargets:
      clamp(
        parsed.recommendedTeachingApproachAndTargets,
        LIMITS.recommendedTeachingApproachAndTargets
      ) || missingFallback,
    conclusion: clamp(parsed.conclusion, LIMITS.conclusion) || missingFallback,
  };
}
