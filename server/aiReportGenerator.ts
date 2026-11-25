import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';

export interface ClassReportSourceInput {
  studentName: string;
  subject: 'Mathematics' | 'Technology';
  topic: string;
  sessionDate: string;
  durationMinutes: number;
  understandingLevel: 'developing' | 'steady' | 'strong' | 'mastered';
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
}

export interface GeneratedAiReportPayload {
  studentName: string;
  subject: 'Mathematics' | 'Technology';
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

const LIMITS = {
  studentName: 120,
  lessonTopic: 200,
  dateAndDuration: 120,
  learningObjectivesCovered: 3000,
  conceptsTaught: 3500,
  activitiesAndExercisesCompleted: 4500,
  studentParticipation: 3000,
  demonstratedUnderstanding: 3000,
  areasRequiringImprovement: 3000,
  challengesEncountered: 3000,
  homeworkAssigned: 3000,
  teacherObservations: 3500,
  recommendedNextSteps: 3000,
} as const;

function clamp(value: string | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

export function hasSubstantiveClassData(input: ClassReportSourceInput): boolean {
  const fields = [
    input.objectivesCovered,
    input.conceptsTaught,
    input.activitiesCompleted,
    input.practicalExercisesPerformed,
    input.classworkGiven,
    input.studentParticipation,
    input.understoodWell,
    input.struggledWith,
    input.challengesEncountered,
    input.homeworkAssigned,
    input.teacherObservations,
    input.recommendationsNextFocus,
    input.notes,
    input.progressNotes,
  ];
  return fields.some((f) => typeof f === 'string' && f.trim().length > 0);
}

export class AiGenerationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

const SYSTEM_INSTRUCTION = [
  'You are an experienced private Mathematics and Technology educator writing formal post-class progress reports for YoungAndCode Teaching Manager.',
  'Analyze ONLY the saved class documentation JSON provided by the teacher.',
  'Writing requirements:',
  '1. Write in clear, professional, natural English suitable for a careful teaching report.',
  '2. Be specific to what actually happened during the class based strictly on the provided record.',
  '3. Avoid generic filler statements, hype, praise padding, or unnecessary repetition across sections.',
  '4. Distinguish clearly between what the student understood well and what still needs improvement.',
  '5. NEVER invent activities, exercises, student achievements, quotes, responses, scores, or learning outcomes not explicitly recorded.',
  '6. NEVER assume that a student mastered or understood a topic simply because it was taught.',
  '7. When a field or detail is blank or missing in the saved documentation, state clearly that it was not recorded in the class documentation (for example: "Not recorded in the class documentation.") instead of guessing.',
  '8. For activitiesAndExercisesCompleted, synthesize recorded activitiesCompleted, practicalExercisesPerformed, classworkGiven, and legacy notes if present; if none are recorded, state that none were recorded.',
  '9. For demonstratedUnderstanding, incorporate only what is documented in understoodWell, studentParticipation, and the teacher-selected understandingLevel label without exaggerating mastery.',
  '10. For areasRequiringImprovement, incorporate only what is documented in struggledWith and any skill gaps explicitly noted.',
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
              studentName: { type: Type.STRING },
              subject: { type: Type.STRING },
              lessonTopic: { type: Type.STRING },
              dateAndDuration: { type: Type.STRING },
              learningObjectivesCovered: { type: Type.STRING },
              conceptsTaught: { type: Type.STRING },
              activitiesAndExercisesCompleted: { type: Type.STRING },
              studentParticipation: { type: Type.STRING },
              demonstratedUnderstanding: { type: Type.STRING },
              areasRequiringImprovement: { type: Type.STRING },
              challengesEncountered: { type: Type.STRING },
              homeworkAssigned: { type: Type.STRING },
              teacherObservations: { type: Type.STRING },
              recommendedNextSteps: { type: Type.STRING },
            },
            required: [
              'studentName',
              'subject',
              'lessonTopic',
              'dateAndDuration',
              'learningObjectivesCovered',
              'conceptsTaught',
              'activitiesAndExercisesCompleted',
              'studentParticipation',
              'demonstratedUnderstanding',
              'areasRequiringImprovement',
              'challengesEncountered',
              'homeworkAssigned',
              'teacherObservations',
              'recommendedNextSteps',
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

export async function generateStructuredClassReport(
  input: ClassReportSourceInput
): Promise<GeneratedAiReportPayload> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiGenerationError(
      'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.',
      503
    );
  }

  if (!hasSubstantiveClassData(input)) {
    throw new AiGenerationError(
      'Cannot generate an AI report from an empty class record. Please record at least one teaching detail (such as objectives, concepts taught, activities, participation, observations, or notes) first.',
      400
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

  const cleanSource = {
    studentName: clamp(input.studentName, LIMITS.studentName),
    subject: input.subject,
    lessonTopic: clamp(input.topic, LIMITS.lessonTopic),
    sessionDate: input.sessionDate.trim(),
    durationMinutes: Math.max(0, Math.min(480, Math.round(input.durationMinutes))),
    understandingLevel: input.understandingLevel,
    objectivesCovered: clamp(input.objectivesCovered, 2500),
    conceptsTaught: clamp(input.conceptsTaught, 3000),
    activitiesCompleted: clamp(input.activitiesCompleted, 3500),
    practicalExercisesPerformed: clamp(input.practicalExercisesPerformed, 2500),
    classworkGiven: clamp(input.classworkGiven, 2500),
    studentParticipation: clamp(input.studentParticipation, 2500),
    understoodWell: clamp(input.understoodWell, 2500),
    struggledWith: clamp(input.struggledWith, 2500),
    challengesEncountered: clamp(input.challengesEncountered, 2500),
    homeworkAssigned: clamp(input.homeworkAssigned, 2500),
    teacherObservations: clamp(input.teacherObservations, 3000),
    recommendationsNextFocus: clamp(input.recommendationsNextFocus, 2500),
    legacyNotes: clamp(input.notes, 5000),
    legacyProgressNotes: clamp(input.progressNotes, 2000),
  };

  const userPrompt = [
    'Generate a structured class report strictly grounded in this saved class documentation record.',
    'Do not extrapolate or invent facts not present below. Indicate clearly whenever a section has no recorded information.',
    '',
    JSON.stringify(cleanSource, null, 2),
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
      'Unable to generate report with Gemini AI right now. Please try again.',
      502
    );
  }

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new AiGenerationError(
      'Gemini returned an empty response. Please try regenerating the report.',
      502
    );
  }

  let parsed: Partial<GeneratedAiReportPayload>;
  try {
    parsed = JSON.parse(rawText) as Partial<GeneratedAiReportPayload>;
  } catch {
    throw new AiGenerationError(
      'Gemini returned an unreadable report format. Please try regenerating.',
      502
    );
  }

  const authoritativeDateDuration = `${cleanSource.sessionDate} · ${cleanSource.durationMinutes} min`;
  const missingFallback = 'Not recorded in the class documentation.';

  return {
    studentName: cleanSource.studentName,
    subject: cleanSource.subject,
    lessonTopic: cleanSource.lessonTopic,
    dateAndDuration: clamp(parsed.dateAndDuration, LIMITS.dateAndDuration) || authoritativeDateDuration,
    learningObjectivesCovered:
      clamp(parsed.learningObjectivesCovered, LIMITS.learningObjectivesCovered) || missingFallback,
    conceptsTaught: clamp(parsed.conceptsTaught, LIMITS.conceptsTaught) || missingFallback,
    activitiesAndExercisesCompleted:
      clamp(parsed.activitiesAndExercisesCompleted, LIMITS.activitiesAndExercisesCompleted) ||
      missingFallback,
    studentParticipation:
      clamp(parsed.studentParticipation, LIMITS.studentParticipation) || missingFallback,
    demonstratedUnderstanding:
      clamp(parsed.demonstratedUnderstanding, LIMITS.demonstratedUnderstanding) || missingFallback,
    areasRequiringImprovement:
      clamp(parsed.areasRequiringImprovement, LIMITS.areasRequiringImprovement) || missingFallback,
    challengesEncountered:
      clamp(parsed.challengesEncountered, LIMITS.challengesEncountered) || missingFallback,
    homeworkAssigned: clamp(parsed.homeworkAssigned, LIMITS.homeworkAssigned) || missingFallback,
    teacherObservations:
      clamp(parsed.teacherObservations, LIMITS.teacherObservations) || missingFallback,
    recommendedNextSteps:
      clamp(parsed.recommendedNextSteps, LIMITS.recommendedNextSteps) || missingFallback,
  };
}
