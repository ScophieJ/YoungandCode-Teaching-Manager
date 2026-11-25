import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileCheck2,
  GraduationCap,
} from 'lucide-react';
import {
  MonthlyReportStatus,
  Subject,
  type MonthlyReportDraft,
} from '../types/teaching';
import { getMonthlyReportStatusClass, getSubjectBadgeClass } from '../lib/uiTokens';

interface MonthlyReportDocumentViewProps {
  report: MonthlyReportDraft & {
    status?: MonthlyReportStatus | string;
    approvedAt?: { toDate?: () => Date };
  };
  teacherName?: string;
}

function TextParagraph({ value }: { value: string | undefined }) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-500 italic">
        Not recorded for this reporting period.
      </p>
    );
  }
  return (
    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
      {trimmed}
    </p>
  );
}

export function MonthlyReportDocumentView({
  report,
  teacherName = 'Private Instructor',
}: MonthlyReportDocumentViewProps) {
  const isApproved = report.status === MonthlyReportStatus.APPROVED;
  const approvedDate = report.approvedAt?.toDate
    ? report.approvedAt.toDate().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : undefined;

  return (
    <article className="print-sheet bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      {/* Branded Document Header */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#1E3A8A] text-white px-6 sm:px-8 py-6 border-b-4 border-blue-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-blue-200" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold tracking-tight text-white">YoungAndCode</p>
              <p className="text-xs text-blue-200 tracking-wide uppercase">
                Monthly Academic Progress Report · Mathematics &amp; Technology
              </p>
            </div>
          </div>

          <div className="sm:text-right shrink-0 space-y-1">
            <p className="text-base font-bold text-white">{report.reportingMonthLabel}</p>
            <div className="inline-flex items-center gap-1.5 text-xs text-blue-100">
              {isApproved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>
                    Approved Report{approvedDate ? ` · ${approvedDate}` : ''}
                  </span>
                </>
              ) : (
                <span>Draft Report (Pending Teacher Approval)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-8">
        {/* A. Student Information */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                A
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Student Information
              </h2>
            </div>
            {report.status && (
              <span
                className={`no-print px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getMonthlyReportStatusClass(
                  report.status
                )}`}
              >
                {isApproved ? 'Approved' : 'Draft'}
              </span>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="w-40 text-left px-4 py-2.5 bg-slate-50 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Student Name
                  </th>
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">
                    {report.studentName}
                  </td>
                  <th className="w-40 text-left px-4 py-2.5 bg-slate-50 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-l border-slate-200 dark:border-slate-800">
                    Reporting Month
                  </th>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                    {report.reportingMonthLabel}
                  </td>
                </tr>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-2.5 bg-slate-50 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Grade &amp; Age
                  </th>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                    {report.gradeAndAge || 'Not recorded'}
                  </td>
                  <th className="text-left px-4 py-2.5 bg-slate-50 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-l border-slate-200 dark:border-slate-800">
                    Subjects Covered
                  </th>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 font-medium">
                    {report.subjectsCovered}
                  </td>
                </tr>
                <tr>
                  <th className="text-left px-4 py-2.5 bg-slate-50 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Instructor
                  </th>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                    {teacherName}
                  </td>
                  <th className="text-left px-4 py-2.5 bg-slate-50 dark:bg-[#0E1629] text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide border-l border-slate-200 dark:border-slate-800">
                    Report Status
                  </th>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                    {isApproved ? 'Approved' : 'Draft'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <ClipboardCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Completed Classes</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {report.completedClassesCount}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Instruction Time</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {report.totalInstructionMinutes} min
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <FileCheck2 className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span>Homework Done</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {report.homeworkCompletedCount}/{report.homeworkAssignedCount}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <GraduationCap className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Approved Class AI</span>
              </div>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {report.approvedAiReportsCount}
              </p>
            </div>
          </div>
        </section>

        {/* B. Academic Activities and Coverage */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="w-7 h-7 rounded-lg bg-teal-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              B
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Academic Activities and Coverage
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Topics Covered During the Month
              </h3>
              <TextParagraph value={report.topicsCovered} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Skills and Concepts Introduced
              </h3>
              <TextParagraph value={report.skillsAndConceptsIntroduced} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Practical Activities and Projects Completed
              </h3>
              <TextParagraph value={report.practicalActivitiesAndProjects} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Learning Objectives Achieved
              </h3>
              <TextParagraph value={report.learningObjectivesAchieved} />
            </div>
          </div>
        </section>

        {/* C. Academic Performance + Subject-Specific Assessments */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              C
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Academic Performance
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Understanding of Concepts
              </h3>
              <TextParagraph value={report.conceptUnderstanding} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Ability to Apply What Was Taught
              </h3>
              <TextParagraph value={report.applicationOfLearning} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Participation and Engagement
              </h3>
              <TextParagraph value={report.participationAndEngagement} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Areas of Strength
              </h3>
              <TextParagraph value={report.areasOfStrength} />
            </div>
            <div className="md:col-span-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Areas Requiring Further Development
              </h3>
              <TextParagraph value={report.areasRequiringDevelopment} />
            </div>
          </div>

          {report.subjectAssessments && report.subjectAssessments.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Subject-Specific Evaluations
              </h3>
              <div
                className={`grid grid-cols-1 ${
                  report.subjectAssessments.length > 1 ? 'lg:grid-cols-2' : ''
                } gap-4`}
              >
                {report.subjectAssessments.map((sa) => (
                  <div
                    key={sa.subject}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0E1629] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${getSubjectBadgeClass(
                          sa.subject as Subject
                        )}`}
                      >
                        {sa.subject}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {sa.classesCompletedCount} completed{' '}
                        {sa.classesCompletedCount === 1 ? 'class' : 'classes'}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Subject Criteria
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        {sa.criteriaFocus}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Coverage Summary
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">
                        {sa.coverageSummary}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Performance Assessment
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">
                        {sa.performanceAssessment}
                      </p>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                        Next Subject Focus
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-wrap">
                        {sa.nextSubjectFocus}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* D. Homework and Assessment */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="w-7 h-7 rounded-lg bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              D
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Homework and Assessment
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Homework Assigned
              </h3>
              <TextParagraph value={report.homeworkAssignedSummary} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Homework Completed &amp; Outstanding
              </h3>
              <TextParagraph value={report.homeworkCompletionStatus} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Assessment Results &amp; Teacher Feedback
              </h3>
              <TextParagraph value={report.assessmentResultsAndFeedback} />
            </div>
          </div>
        </section>

        {/* E. Challenges and Areas for Improvement */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="w-7 h-7 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              E
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Challenges and Areas for Improvement
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Specific Difficulties Observed
              </h3>
              <TextParagraph value={report.specificDifficultiesObserved} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Concepts Needing Revision
              </h3>
              <TextParagraph value={report.conceptsNeedingRevision} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Skills Requiring More Practice
              </h3>
              <TextParagraph value={report.skillsRequiringPractice} />
            </div>
          </div>
        </section>

        {/* F. Teacher's Remarks */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="w-7 h-7 rounded-lg bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              F
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Teacher&apos;s Remarks
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Overall Monthly Assessment
              </h3>
              <TextParagraph value={report.overallMonthlyAssessment} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Progress Made During the Month
              </h3>
              <TextParagraph value={report.progressMadeDuringMonth} />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                Recommended Approach &amp; Targets
              </h3>
              <TextParagraph value={report.recommendedTeachingApproachAndTargets} />
            </div>
          </div>
        </section>

        {/* G. Conclusion */}
        <section className="space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
              G
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Conclusion
            </h2>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200/80 dark:border-slate-800">
            <TextParagraph value={report.conclusion} />
          </div>
        </section>

        <footer className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>YoungAndCode Teaching Manager · Official Student Progress Report</span>
          <span>Prepared by {teacherName}</span>
        </footer>
      </div>
    </article>
  );
}
