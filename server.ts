import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { verifyFirebaseBearerToken } from './server/firebaseAuth.ts';
import {
  AiGenerationError,
  generateStructuredClassReport,
  hasSubstantiveClassData,
  type ClassReportSourceInput,
} from './server/aiReportGenerator.ts';
import {
  generateStructuredMonthlyReport,
  type MonthlyReportSourcePayload,
} from './server/monthlyReportGenerator.ts';
import {
  getIntegrationCapabilitiesSnapshot,
  verifyWebhookSignature,
} from './server/integrationRegistry.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function createServer() {
  const app = express();

  app.disable('x-powered-by');

  // Signed webhook endpoint receives raw bytes for HMAC verification before JSON parsing
  app.post(
    '/api/integrations/webhooks/:providerId',
    express.raw({ type: 'application/json', limit: '256kb' }),
    (req, res) => {
      const providerId = String(req.params.providerId || '').toLowerCase();
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : '');
      const check = verifyWebhookSignature(providerId, rawBody, req.headers);
      if (!check.ok) {
        res.status(check.status).json({ error: check.message });
        return;
      }
      res.status(202).json({
        received: true,
        provider: providerId,
        message: check.message,
      });
    }
  );

  app.use(express.json({ limit: '1mb' }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health endpoint for server verification
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'youngandcode-teaching-manager',
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side integration capabilities & OAuth/API readiness (never exposes secret values)
  app.get('/api/integrations/capabilities', async (req, res) => {
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
    } catch (authErr) {
      res.status(401).json({
        error:
          authErr instanceof Error
            ? authErr.message
            : 'Authentication required to inspect integration capabilities.',
      });
      return;
    }

    res.json({
      capabilities: getIntegrationCapabilitiesSnapshot(),
      checkedAt: new Date().toISOString(),
    });
  });

  app.get('/api/integrations/oauth/:providerId/status', async (req, res) => {
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
    } catch (authErr) {
      res.status(401).json({
        error:
          authErr instanceof Error
            ? authErr.message
            : 'Authentication required to check OAuth status.',
      });
      return;
    }

    const providerId = String(req.params.providerId || '').toLowerCase();
    const match = getIntegrationCapabilitiesSnapshot().find((c) => c.key === providerId);
    if (!match) {
      res.json({
        providerId,
        configured: false,
        authMode: 'direct_link',
        notes: 'No server-side OAuth configuration required for direct-link access.',
      });
      return;
    }

    res.json({
      providerId,
      ...match,
    });
  });

  // Server-side Gemini class report generation (requires verified Firebase user token)
  app.post('/api/ai/generate-class-report', async (req, res) => {
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
    } catch (authErr) {
      res.status(401).json({
        error:
          authErr instanceof Error
            ? authErr.message
            : 'Authentication required to generate AI reports.',
      });
      return;
    }

    const body = req.body as { classReport?: Partial<ClassReportSourceInput> } | null;
    const raw = body?.classReport;

    if (!raw || typeof raw !== 'object') {
      res.status(400).json({ error: 'Missing saved class documentation payload.' });
      return;
    }

    if (
      typeof raw.studentName !== 'string' ||
      !raw.studentName.trim() ||
      (raw.subject !== 'Mathematics' && raw.subject !== 'Technology') ||
      typeof raw.topic !== 'string' ||
      !raw.topic.trim() ||
      typeof raw.sessionDate !== 'string' ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(raw.sessionDate)
    ) {
      res.status(400).json({
        error:
          'Class documentation must include a valid student name, subject, lesson topic, and session date.',
      });
      return;
    }

    const rawLevel = raw.understandingLevel;
    const understandingLevel: ClassReportSourceInput['understandingLevel'] =
      rawLevel === 'developing' ||
      rawLevel === 'steady' ||
      rawLevel === 'strong' ||
      rawLevel === 'mastered'
        ? rawLevel
        : 'steady';

    const sourceInput: ClassReportSourceInput = {
      studentName: raw.studentName,
      subject: raw.subject,
      topic: raw.topic,
      sessionDate: raw.sessionDate,
      durationMinutes:
        typeof raw.durationMinutes === 'number' && Number.isFinite(raw.durationMinutes)
          ? raw.durationMinutes
          : 0,
      understandingLevel,
      objectivesCovered:
        typeof raw.objectivesCovered === 'string' ? raw.objectivesCovered : '',
      conceptsTaught: typeof raw.conceptsTaught === 'string' ? raw.conceptsTaught : '',
      activitiesCompleted:
        typeof raw.activitiesCompleted === 'string' ? raw.activitiesCompleted : '',
      practicalExercisesPerformed:
        typeof raw.practicalExercisesPerformed === 'string'
          ? raw.practicalExercisesPerformed
          : '',
      classworkGiven: typeof raw.classworkGiven === 'string' ? raw.classworkGiven : '',
      studentParticipation:
        typeof raw.studentParticipation === 'string' ? raw.studentParticipation : '',
      understoodWell: typeof raw.understoodWell === 'string' ? raw.understoodWell : '',
      struggledWith: typeof raw.struggledWith === 'string' ? raw.struggledWith : '',
      challengesEncountered:
        typeof raw.challengesEncountered === 'string' ? raw.challengesEncountered : '',
      homeworkAssigned:
        typeof raw.homeworkAssigned === 'string' ? raw.homeworkAssigned : '',
      teacherObservations:
        typeof raw.teacherObservations === 'string' ? raw.teacherObservations : '',
      recommendationsNextFocus:
        typeof raw.recommendationsNextFocus === 'string'
          ? raw.recommendationsNextFocus
          : '',
      notes: typeof raw.notes === 'string' ? raw.notes : '',
      progressNotes: typeof raw.progressNotes === 'string' ? raw.progressNotes : '',
    };

    if (!hasSubstantiveClassData(sourceInput)) {
      res.status(400).json({
        error:
          'This class documentation record has no recorded teaching details yet. Please enter lesson notes, objectives, activities, or observations before generating an AI report.',
      });
      return;
    }

    try {
      const report = await generateStructuredClassReport(sourceInput);
      res.json({ report });
    } catch (err) {
      if (err instanceof AiGenerationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({
        error: 'Unexpected error while generating the class report. Please try again.',
      });
    }
  });

  // Server-side Gemini monthly academic progress report generation (requires verified Firebase user token)
  app.post('/api/ai/generate-monthly-report', async (req, res) => {
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
    } catch (authErr) {
      res.status(401).json({
        error:
          authErr instanceof Error
            ? authErr.message
            : 'Authentication required to generate monthly progress reports.',
      });
      return;
    }

    const body = req.body as { payload?: Partial<MonthlyReportSourcePayload> } | null;
    const raw = body?.payload;

    if (!raw || typeof raw !== 'object' || !raw.student || typeof raw.student !== 'object') {
      res.status(400).json({ error: 'Missing compiled student monthly records payload.' });
      return;
    }

    if (
      typeof raw.student.fullName !== 'string' ||
      !raw.student.fullName.trim() ||
      typeof raw.monthKey !== 'string' ||
      !/^[0-9]{4}-[0-9]{2}$/.test(raw.monthKey) ||
      typeof raw.reportingMonthLabel !== 'string' ||
      !raw.reportingMonthLabel.trim() ||
      !Array.isArray(raw.subjectsCoveredList) ||
      raw.subjectsCoveredList.length === 0
    ) {
      res.status(400).json({
        error: 'Monthly report request must specify a valid student, monthKey (YYYY-MM), and subjects.',
      });
      return;
    }

    const validSubjects = raw.subjectsCoveredList.filter(
      (s): s is 'Mathematics' | 'Technology' => s === 'Mathematics' || s === 'Technology'
    );
    if (validSubjects.length === 0) {
      res.status(400).json({ error: 'Monthly report requires at least one valid subject.' });
      return;
    }

    const safePayload: MonthlyReportSourcePayload = {
      student: {
        id: typeof raw.student.id === 'string' ? raw.student.id : '',
        fullName: raw.student.fullName,
        age: typeof raw.student.age === 'string' ? raw.student.age : '',
        grade: typeof raw.student.grade === 'string' ? raw.student.grade : '',
        gradeAndAge:
          typeof raw.student.gradeAndAge === 'string' && raw.student.gradeAndAge.trim()
            ? raw.student.gradeAndAge
            : 'Not recorded',
        school: typeof raw.student.school === 'string' ? raw.student.school : '',
        subjects: Array.isArray(raw.student.subjects)
          ? raw.student.subjects.filter(
              (s): s is 'Mathematics' | 'Technology' =>
                s === 'Mathematics' || s === 'Technology'
            )
          : validSubjects,
        mathLevel: typeof raw.student.mathLevel === 'string' ? raw.student.mathLevel : '',
        techLevel: typeof raw.student.techLevel === 'string' ? raw.student.techLevel : '',
        learningGoals:
          typeof raw.student.learningGoals === 'string' ? raw.student.learningGoals : '',
        teachingNotes:
          typeof raw.student.teachingNotes === 'string' ? raw.student.teachingNotes : '',
      },
      monthKey: raw.monthKey,
      reportYear:
        typeof raw.reportYear === 'number' && Number.isFinite(raw.reportYear)
          ? Math.round(raw.reportYear)
          : Number(raw.monthKey.slice(0, 4)),
      reportMonth:
        typeof raw.reportMonth === 'number' && Number.isFinite(raw.reportMonth)
          ? Math.round(raw.reportMonth)
          : Number(raw.monthKey.slice(5, 7)),
      reportingMonthLabel: raw.reportingMonthLabel,
      subjectsCoveredList: validSubjects,
      subjectsCoveredText:
        typeof raw.subjectsCoveredText === 'string' && raw.subjectsCoveredText.trim()
          ? raw.subjectsCoveredText
          : validSubjects.join(', '),
      stats: {
        completedClassesCount: Number(raw.stats?.completedClassesCount ?? 0) || 0,
        approvedAiReportsCount: Number(raw.stats?.approvedAiReportsCount ?? 0) || 0,
        totalInstructionMinutes: Number(raw.stats?.totalInstructionMinutes ?? 0) || 0,
        homeworkAssignedCount: Number(raw.stats?.homeworkAssignedCount ?? 0) || 0,
        homeworkCompletedCount: Number(raw.stats?.homeworkCompletedCount ?? 0) || 0,
        homeworkOutstandingCount: Number(raw.stats?.homeworkOutstandingCount ?? 0) || 0,
        homeworkSubmittedOrReviewCount:
          Number(raw.stats?.homeworkSubmittedOrReviewCount ?? 0) || 0,
        homeworkOverdueCount: Number(raw.stats?.homeworkOverdueCount ?? 0) || 0,
        excludedCancelledPlansCount: Number(raw.stats?.excludedCancelledPlansCount ?? 0) || 0,
        excludedDraftOrLiveClassesCount:
          Number(raw.stats?.excludedDraftOrLiveClassesCount ?? 0) || 0,
        uncompletedPlannedLessonsCount:
          Number(raw.stats?.uncompletedPlannedLessonsCount ?? 0) || 0,
      },
      completedClasses: Array.isArray(raw.completedClasses) ? raw.completedClasses : [],
      standaloneApprovedAiReports: Array.isArray(raw.standaloneApprovedAiReports)
        ? raw.standaloneApprovedAiReports
        : [],
      uncompletedPlannedLessons: Array.isArray(raw.uncompletedPlannedLessons)
        ? raw.uncompletedPlannedLessons
        : [],
      homeworkRecords: Array.isArray(raw.homeworkRecords) ? raw.homeworkRecords : [],
    };

    try {
      const report = await generateStructuredMonthlyReport(safePayload);
      res.json({ report });
    } catch (err) {
      if (err instanceof AiGenerationError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      res.status(500).json({
        error: 'Unexpected error while generating the monthly progress report. Please try again.',
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YoungAndCode Teaching Manager running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
