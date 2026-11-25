import {
  ClassReportStatus,
  HomeworkStatus,
  IntegrationConnectionStatus,
  IntegrationMethod,
  LessonPlanStatus,
  MonthlyReportStatus,
  Subject,
  UnderstandingLevel,
  type IntegrationAccentColor,
} from '../types/teaching';

export const INPUT_CLASS =
  'w-full px-3 py-2 text-sm bg-white dark:bg-[#0E1629] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 transition-colors';

export const FILTER_INPUT_CLASS =
  'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#0E1629] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-[#0E1629] focus:border-blue-500 dark:focus:border-blue-400 transition-colors';

export const CARD_CLASS =
  'bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs';

const AVATAR_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-teal-500 to-emerald-600',
  'from-violet-600 to-purple-600',
  'from-orange-500 to-amber-600',
  'from-sky-500 to-blue-600',
];

export function getStudentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getStudentAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

export function getSubjectBadgeClass(subject: Subject): string {
  if (subject === Subject.MATHEMATICS) {
    return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
  }
  return 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30';
}

export function getLessonStatusClass(status: LessonPlanStatus): string {
  switch (status) {
    case LessonPlanStatus.DRAFT:
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    case LessonPlanStatus.SCHEDULED:
    case LessonPlanStatus.UPCOMING:
      return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    case LessonPlanStatus.COMPLETED:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
    case LessonPlanStatus.CANCELLED:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

export function getClassReportStatusClass(status: ClassReportStatus): string {
  switch (status) {
    case ClassReportStatus.IN_PROGRESS:
      return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    case ClassReportStatus.DRAFT:
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    case ClassReportStatus.COMPLETED:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
  }
}

export function getUnderstandingBadgeClass(level: UnderstandingLevel): string {
  switch (level) {
    case UnderstandingLevel.MASTERED:
      return 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30';
    case UnderstandingLevel.STRONG:
      return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    case UnderstandingLevel.STEADY:
      return 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30';
    case UnderstandingLevel.DEVELOPING:
    default:
      return 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30';
  }
}

export function getHomeworkStatusClass(status: HomeworkStatus | string): string {
  switch (status) {
    case HomeworkStatus.ASSIGNED:
    case HomeworkStatus.PENDING:
      return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30';
    case HomeworkStatus.SUBMITTED:
      return 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30';
    case HomeworkStatus.UNDER_REVIEW:
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    case HomeworkStatus.OVERDUE:
      return 'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30';
    case HomeworkStatus.COMPLETED:
    case HomeworkStatus.REVIEWED:
    default:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
  }
}

export function getMonthlyReportStatusClass(status: MonthlyReportStatus | string): string {
  if (status === MonthlyReportStatus.APPROVED) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
  }
  return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
}

export function getIntegrationStatusClass(
  status: IntegrationConnectionStatus | string
): string {
  switch (status) {
    case IntegrationConnectionStatus.CONNECTED:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30';
    case IntegrationConnectionStatus.CONFIGURATION_REQUIRED:
      return 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30';
    case IntegrationConnectionStatus.DISCONNECTED:
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function getIntegrationMethodBadgeClass(
  method: IntegrationMethod | string
): string {
  switch (method) {
    case IntegrationMethod.DIRECT_LINK:
      return 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30';
    case IntegrationMethod.OAUTH:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30';
    case IntegrationMethod.API:
      return 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30';
    case IntegrationMethod.WEBHOOK:
      return 'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30';
    case IntegrationMethod.CUSTOM:
    default:
      return 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30';
  }
}

export function getIntegrationAccentClasses(color: IntegrationAccentColor | string): {
  iconBox: string;
  softTint: string;
} {
  switch (color) {
    case 'indigo':
      return {
        iconBox: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-200/70 dark:border-indigo-500/30',
        softTint: 'from-indigo-500/10 to-blue-500/10',
      };
    case 'violet':
      return {
        iconBox: 'bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-200/70 dark:border-violet-500/30',
        softTint: 'from-violet-500/10 to-purple-500/10',
      };
    case 'teal':
      return {
        iconBox: 'bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300 border-teal-200/70 dark:border-teal-500/30',
        softTint: 'from-teal-500/10 to-emerald-500/10',
      };
    case 'emerald':
      return {
        iconBox: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-500/30',
        softTint: 'from-emerald-500/10 to-teal-500/10',
      };
    case 'orange':
      return {
        iconBox: 'bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-200/70 dark:border-orange-500/30',
        softTint: 'from-orange-500/10 to-amber-500/10',
      };
    case 'amber':
      return {
        iconBox: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-500/30',
        softTint: 'from-amber-500/10 to-orange-500/10',
      };
    case 'rose':
      return {
        iconBox: 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-200/70 dark:border-rose-500/30',
        softTint: 'from-rose-500/10 to-orange-500/10',
      };
    case 'slate':
      return {
        iconBox: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700',
        softTint: 'from-slate-500/10 to-slate-400/10',
      };
    case 'blue':
    default:
      return {
        iconBox: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-200/70 dark:border-blue-500/30',
        softTint: 'from-blue-500/10 to-indigo-500/10',
      };
  }
}
