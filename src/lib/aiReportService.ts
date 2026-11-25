import { auth } from './firebase';
import type { AiReportDraft, ClassReport, MonthlyReportDraft } from '../types/teaching';
import type { CompiledMonthlyStudentPayload } from './monthlyReportCompiler';

export function hasSubstantiveDocumentation(report: ClassReport): boolean {
  const fields = [
    report.objectivesCovered,
    report.conceptsTaught,
    report.activitiesCompleted,
    report.practicalExercisesPerformed,
    report.classworkGiven,
    report.studentParticipation,
    report.understoodWell,
    report.struggledWith,
    report.challengesEncountered,
    report.homeworkAssigned,
    report.teacherObservations,
    report.recommendationsNextFocus,
    report.notes,
    report.progressNotes,
  ];
  return fields.some((value) => typeof value === 'string' && value.trim().length > 0);
}

export async function generateAiClassReport(report: ClassReport): Promise<AiReportDraft> {
  if (!hasSubstantiveDocumentation(report)) {
    throw new Error(
      'This class record has no saved teaching details yet. Please add lesson notes, objectives, activities, or observations and save before generating an AI report.'
    );
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to generate an AI report.');
  }

  const idToken = await currentUser.getIdToken();

  let response: Response;
  try {
    response = await fetch('/api/ai/generate-class-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        classReport: {
          studentName: report.studentName,
          subject: report.subject,
          topic: report.topic,
          sessionDate: report.sessionDate,
          durationMinutes: report.durationMinutes,
          understandingLevel: report.understandingLevel,
          objectivesCovered: report.objectivesCovered ?? '',
          conceptsTaught: report.conceptsTaught ?? '',
          activitiesCompleted: report.activitiesCompleted ?? '',
          practicalExercisesPerformed: report.practicalExercisesPerformed ?? '',
          classworkGiven: report.classworkGiven ?? '',
          studentParticipation: report.studentParticipation ?? '',
          understoodWell: report.understoodWell ?? '',
          struggledWith: report.struggledWith ?? '',
          challengesEncountered: report.challengesEncountered ?? '',
          homeworkAssigned: report.homeworkAssigned ?? '',
          teacherObservations: report.teacherObservations ?? '',
          recommendationsNextFocus: report.recommendationsNextFocus ?? '',
          notes: report.notes ?? '',
          progressNotes: report.progressNotes ?? '',
        },
      }),
    });
  } catch {
    throw new Error(
      'Unable to reach the report generation service. Please check your connection and try again.'
    );
  }

  let data: { report?: AiReportDraft; error?: string } = {};
  try {
    data = (await response.json()) as { report?: AiReportDraft; error?: string };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok || !data.report) {
    throw new Error(
      data.error || `AI report generation failed (status ${response.status}).`
    );
  }

  return data.report;
}

export async function generateAiMonthlyReport(
  compiled: CompiledMonthlyStudentPayload
): Promise<MonthlyReportDraft> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to generate a monthly progress report.');
  }

  const idToken = await currentUser.getIdToken();

  let response: Response;
  try {
    response = await fetch('/api/ai/generate-monthly-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ payload: compiled }),
    });
  } catch {
    throw new Error(
      'Unable to reach the monthly report generation service. Please check your connection and try again.'
    );
  }

  let data: { report?: MonthlyReportDraft; error?: string } = {};
  try {
    data = (await response.json()) as { report?: MonthlyReportDraft; error?: string };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok || !data.report) {
    throw new Error(
      data.error || `Monthly report generation failed (status ${response.status}).`
    );
  }

  return data.report;
}
