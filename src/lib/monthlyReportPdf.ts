import { jsPDF } from 'jspdf';
import {
  MonthlyReportStatus,
  type MonthlyReport,
  type MonthlyReportDraft,
} from '../types/teaching';

type ExportableMonthlyReport = MonthlyReportDraft & {
  status?: MonthlyReportStatus | string;
  approvedAt?: { toDate?: () => Date };
};

export function getMonthlyReportPdfFilename(report: {
  studentName: string;
  monthKey: string;
}): string {
  const safeName = report.studentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeMonth = report.monthKey.replace(/[^0-9\-]/g, '');
  return `YoungAndCode_Progress_Report_${safeName || 'student'}_${safeMonth || 'month'}.pdf`;
}

export function buildMonthlyReportPdfDocument(
  report: ExportableMonthlyReport,
  teacherName = 'Private Instructor'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  const bottomLimit = pageH - 18;
  let y = 0;

  const isApproved = report.status === MonthlyReportStatus.APPROVED;
  const approvedDateText = report.approvedAt?.toDate
    ? report.approvedAt.toDate().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : undefined;

  const drawBrandHeader = () => {
    // Deep navy header banner
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, pageW, 30, 'F');
    // Electric blue bottom accent bar
    doc.setFillColor(37, 99, 235); // #2563EB
    doc.rect(0, 30, pageW, 1.8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('YoungAndCode', marginX, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(191, 219, 254); // soft blue
    doc.text('MONTHLY ACADEMIC PROGRESS REPORT · MATHEMATICS & TECHNOLOGY', marginX, 20.5);

    // Right reporting period pill
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(report.reportingMonthLabel, pageW - marginX, 13, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    const statusLine = isApproved
      ? `Approved Report${approvedDateText ? ` · ${approvedDateText}` : ''}`
      : 'Draft Report (Pending Approval)';
    doc.text(statusLine, pageW - marginX, 20.5, { align: 'right' });

    y = 40;
  };

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm <= bottomLimit) return;
    doc.addPage();
    // Subtle continuation bar on pages 2+
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 11, 'F');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 11, pageW, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `YoungAndCode · ${report.studentName} · ${report.reportingMonthLabel}`,
      marginX,
      7.2
    );
    y = 20;
  };

  const drawSectionHeading = (code: string, title: string, accentRgb: [number, number, number]) => {
    ensureSpace(16);
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.roundedRect(marginX, y, 7, 6.5, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(code, marginX + 3.5, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(title, marginX + 10, y + 4.8);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + 8.5, pageW - marginX, y + 8.5);
    y += 12;
  };

  const drawFieldBlock = (label: string, value: string | undefined) => {
    const cleanText = value?.trim() || 'Not recorded for this reporting period.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(cleanText, contentW - 2) as string[];
    const needed = 6 + lines.length * 4.5 + 3;
    ensureSpace(Math.min(needed, 40));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(label.toUpperCase(), marginX, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    for (const line of lines) {
      if (y + 5 > bottomLimit) {
        ensureSpace(12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 41, 59);
      }
      doc.text(line, marginX, y);
      y += 4.4;
    }
    y += 3.5;
  };

  const drawKeyValueTable = (rows: Array<[string, string, string, string]>) => {
    const halfW = contentW / 2;
    const labelW = 36;
    const valW = halfW - labelW - 3;

    for (const [k1, v1, k2, v2] of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const l1 = doc.splitTextToSize(v1 || '—', valW) as string[];
      const l2 = doc.splitTextToSize(v2 || '—', valW) as string[];
      const rowLines = Math.max(l1.length, l2.length, 1);
      const rowH = Math.max(8.5, rowLines * 4.3 + 4);
      ensureSpace(rowH + 2);

      // Left cell
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, y, labelW, rowH, 'FD');
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX + labelW, y, halfW - labelW, rowH, 'FD');

      // Right cell
      doc.setFillColor(248, 250, 252);
      doc.rect(marginX + halfW, y, labelW, rowH, 'FD');
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX + halfW + labelW, y, halfW - labelW, rowH, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(k1, marginX + 2.5, y + 5.2);
      doc.text(k2, marginX + halfW + 2.5, y + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(l1, marginX + labelW + 2.5, y + 5.2);
      doc.text(l2, marginX + halfW + labelW + 2.5, y + 5.2);

      y += rowH;
    }
    y += 4;
  };

  drawBrandHeader();

  // Section A: Student Information
  drawSectionHeading('A', 'Student Information', [37, 99, 235]);
  drawKeyValueTable([
    ['Student Name', report.studentName, 'Reporting Month', report.reportingMonthLabel],
    ['Grade & Age', report.gradeAndAge || 'Not recorded', 'Subjects Covered', report.subjectsCovered],
    ['Instructor', teacherName, 'Report Status', isApproved ? 'Approved' : 'Draft'],
  ]);

  // Documented Record Metrics Table (4 columns)
  const metricColW = contentW / 4;
  const metrics = [
    { label: 'Completed Classes', value: String(report.completedClassesCount) },
    { label: 'Instruction Time', value: `${report.totalInstructionMinutes} min` },
    {
      label: 'Homework Completed',
      value: `${report.homeworkCompletedCount} / ${report.homeworkAssignedCount}`,
    },
    { label: 'Approved Class Reports', value: String(report.approvedAiReportsCount) },
  ];
  ensureSpace(17);
  metrics.forEach((m, idx) => {
    const x = marginX + idx * metricColW;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(x, y, metricColW, 13.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(m.value, x + metricColW / 2, y + 6.2, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(m.label, x + metricColW / 2, y + 10.8, { align: 'center' });
  });
  y += 19;

  // Section B: Academic Activities and Coverage
  drawSectionHeading('B', 'Academic Activities and Coverage', [13, 148, 136]);
  drawFieldBlock('Topics Covered During the Month', report.topicsCovered);
  drawFieldBlock('Skills and Concepts Introduced', report.skillsAndConceptsIntroduced);
  drawFieldBlock('Practical Activities and Projects Completed', report.practicalActivitiesAndProjects);
  drawFieldBlock('Learning Objectives Achieved', report.learningObjectivesAchieved);

  // Section C: Academic Performance
  drawSectionHeading('C', 'Academic Performance', [79, 70, 229]);
  drawFieldBlock('Understanding of Concepts', report.conceptUnderstanding);
  drawFieldBlock('Ability to Apply What Was Taught', report.applicationOfLearning);
  drawFieldBlock('Participation and Engagement', report.participationAndEngagement);
  drawFieldBlock('Areas of Strength', report.areasOfStrength);
  drawFieldBlock('Areas Requiring Further Development', report.areasRequiringDevelopment);

  // Separate Subject-Specific Assessments
  if (report.subjectAssessments && report.subjectAssessments.length > 0) {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('SUBJECT-SPECIFIC ASSESSMENTS', marginX, y);
    y += 4.5;

    for (const sa of report.subjectAssessments) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const critLines = doc.splitTextToSize(`Criteria: ${sa.criteriaFocus}`, contentW - 8) as string[];
      const covLines = doc.splitTextToSize(`Coverage: ${sa.coverageSummary}`, contentW - 8) as string[];
      const perfLines = doc.splitTextToSize(
        `Performance: ${sa.performanceAssessment}`,
        contentW - 8
      ) as string[];
      const nextLines = doc.splitTextToSize(`Next Focus: ${sa.nextSubjectFocus}`, contentW - 8) as string[];
      const blockH =
        10 +
        (critLines.length + covLines.length + perfLines.length + nextLines.length) * 4.2 +
        8;

      ensureSpace(Math.min(blockH, 55));

      // Header bar for subject
      const isMath = sa.subject === 'Mathematics';
      doc.setFillColor(isMath ? 239 : 240, isMath ? 246 : 253, isMath ? 255 : 250);
      doc.setDrawColor(isMath ? 191 : 153, isMath ? 219 : 246, isMath ? 254 : 228);
      doc.rect(marginX, y, contentW, 7.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(isMath ? 29 : 15, isMath ? 78 : 118, isMath ? 216 : 110);
      doc.text(
        `${sa.subject} (${sa.classesCompletedCount} completed ${
          sa.classesCompletedCount === 1 ? 'class' : 'classes'
        })`,
        marginX + 3,
        y + 5.1
      );
      y += 10.5;

      const writeSubjectLineGroup = (lines: string[]) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        for (const line of lines) {
          if (y + 5 > bottomLimit) {
            ensureSpace(12);
          }
          doc.text(line, marginX + 3, y);
          y += 4.2;
        }
        y += 1.8;
      };

      writeSubjectLineGroup(critLines);
      writeSubjectLineGroup(covLines);
      writeSubjectLineGroup(perfLines);
      writeSubjectLineGroup(nextLines);
      y += 2;
    }
  }

  // Section D: Homework and Assessment
  drawSectionHeading('D', 'Homework and Assessment', [234, 88, 12]);
  drawFieldBlock('Homework Assigned', report.homeworkAssignedSummary);
  drawFieldBlock('Homework Completed and Outstanding', report.homeworkCompletionStatus);
  drawFieldBlock('Assessment Results and Teacher Feedback', report.assessmentResultsAndFeedback);

  // Section E: Challenges and Areas for Improvement
  drawSectionHeading('E', 'Challenges and Areas for Improvement', [217, 119, 6]);
  drawFieldBlock('Specific Difficulties Observed', report.specificDifficultiesObserved);
  drawFieldBlock('Concepts Needing Revision', report.conceptsNeedingRevision);
  drawFieldBlock('Skills Requiring More Practice', report.skillsRequiringPractice);

  // Section F: Teacher's Remarks
  drawSectionHeading('F', "Teacher's Remarks", [124, 58, 237]);
  drawFieldBlock('Overall Monthly Assessment', report.overallMonthlyAssessment);
  drawFieldBlock('Progress Made During the Month', report.progressMadeDuringMonth);
  drawFieldBlock(
    'Recommended Teaching Approach and Next Learning Targets',
    report.recommendedTeachingApproachAndTargets
  );

  // Section G: Conclusion
  drawSectionHeading('G', 'Conclusion', [15, 23, 42]);
  drawFieldBlock('Summary of Monthly Progress', report.conclusion);

  // Stamp footer & page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageH - 13, pageW - marginX, pageH - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'YoungAndCode Teaching Manager · Confidential Monthly Academic Progress Report',
      marginX,
      pageH - 8.5
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 8.5, { align: 'right' });
  }

  return doc;
}

export function downloadMonthlyReportPdf(
  report: ExportableMonthlyReport,
  teacherName?: string
): void {
  const doc = buildMonthlyReportPdfDocument(report, teacherName);
  const filename = getMonthlyReportPdfFilename(report);
  doc.save(filename);
}
