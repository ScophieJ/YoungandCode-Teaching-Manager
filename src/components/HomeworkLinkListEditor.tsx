import { useState } from 'react';
import {
  ExternalLink,
  FileText,
  LayoutDashboard,
  Link2,
  Plus,
  Trash2,
  Video,
} from 'lucide-react';
import {
  BLUEPRINT_LIMITS,
  detectHomeworkLinkKind,
  formatHomeworkLinkKindLabel,
  HomeworkLinkKind,
  type HomeworkLink,
} from '../types/teaching';
import { sanitizeHttpUrl } from '../lib/firestoreService';
import { INPUT_CLASS } from '../lib/uiTokens';

export function getHomeworkLinkStyle(kind: HomeworkLinkKind | string): {
  badgeClass: string;
  Icon: typeof Link2;
} {
  switch (kind) {
    case HomeworkLinkKind.GOOGLE_DOC:
      return {
        badgeClass:
          'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
        Icon: FileText,
      };
    case HomeworkLinkKind.MIRO:
      return {
        badgeClass:
          'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
        Icon: LayoutDashboard,
      };
    case HomeworkLinkKind.YOUTUBE:
      return {
        badgeClass:
          'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
        Icon: Video,
      };
    case HomeworkLinkKind.WORKSHEET:
      return {
        badgeClass:
          'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
        Icon: FileText,
      };
    case HomeworkLinkKind.OTHER:
    default:
      return {
        badgeClass:
          'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
        Icon: Link2,
      };
  }
}

export function HomeworkLinkBadges({
  links,
  compact = false,
}: {
  links?: HomeworkLink[];
  compact?: boolean;
}) {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((link, idx) => {
        const { badgeClass, Icon } = getHomeworkLinkStyle(link.kind);
        return (
          <a
            key={`${link.url}-${idx}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={`inline-flex items-center gap-1.5 border rounded-lg font-medium transition-opacity hover:opacity-85 ${badgeClass} ${
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
            }`}
            title={`${formatHomeworkLinkKindLabel(link.kind)}: ${link.url}`}
          >
            <Icon className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
            <span className="truncate max-w-44">{link.title}</span>
            <ExternalLink className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
          </a>
        );
      })}
    </div>
  );
}

interface HomeworkLinkListEditorProps {
  label: string;
  helperText?: string;
  links: HomeworkLink[];
  onChange: (next: HomeworkLink[]) => void;
  draftTitle: string;
  onDraftTitleChange: (val: string) => void;
  draftUrl: string;
  onDraftUrlChange: (val: string) => void;
  draftKind: HomeworkLinkKind;
  onDraftKindChange: (val: HomeworkLinkKind) => void;
}

export function HomeworkLinkListEditor({
  label,
  helperText,
  links,
  onChange,
  draftTitle,
  onDraftTitleChange,
  draftUrl,
  onDraftUrlChange,
  draftKind,
  onDraftKindChange,
}: HomeworkLinkListEditorProps) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const [kindManuallyChosen, setKindManuallyChosen] = useState(false);

  const handleUrlChange = (val: string) => {
    onDraftUrlChange(val);
    setLinkError(null);
    if (!kindManuallyChosen && val.trim().length > 6) {
      onDraftKindChange(detectHomeworkLinkKind(val));
    }
  };

  const handleAdd = () => {
    setLinkError(null);
    if (links.length >= BLUEPRINT_LIMITS.homework.maxLinks) {
      setLinkError(`Maximum of ${BLUEPRINT_LIMITS.homework.maxLinks} links reached.`);
      return;
    }
    const safeUrl = sanitizeHttpUrl(draftUrl);
    if (!safeUrl || safeUrl.length < 8) {
      setLinkError('Enter a valid URL starting with https:// or http://');
      return;
    }
    const cleanTitle =
      draftTitle.trim().slice(0, BLUEPRINT_LIMITS.homework.linkTitleMax) ||
      formatHomeworkLinkKindLabel(draftKind);

    onChange([
      ...links,
      {
        title: cleanTitle,
        url: safeUrl,
        kind: draftKind,
      },
    ]);
    onDraftTitleChange('');
    onDraftUrlChange('');
    onDraftKindChange(HomeworkLinkKind.GOOGLE_DOC);
    setKindManuallyChosen(false);
  };

  const handleRemove = (index: number) => {
    onChange(links.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
          {links.length}/{BLUEPRINT_LIMITS.homework.maxLinks}
        </span>
      </div>
      {helperText && (
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">{helperText}</p>
      )}

      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map((item, index) => {
            const { badgeClass, Icon } = getHomeworkLinkStyle(item.kind);
            return (
              <div
                key={`${item.url}-${index}`}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0E1629] border border-slate-200/80 dark:border-slate-700/80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border shrink-0 ${badgeClass}`}
                  >
                    <Icon className="w-3 h-3" />
                    {formatHomeworkLinkKindLabel(item.kind)}
                  </span>
                  <div className="min-w-0">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                    >
                      {item.title}
                    </a>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {item.url}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors shrink-0"
                  aria-label={`Remove ${item.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {links.length < BLUEPRINT_LIMITS.homework.maxLinks && (
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-[#0E1629]/80 border border-dashed border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4">
              <select
                value={draftKind}
                onChange={(e) => {
                  setKindManuallyChosen(true);
                  onDraftKindChange(e.target.value as HomeworkLinkKind);
                }}
                aria-label="Resource link platform"
                className={INPUT_CLASS}
              >
                <option value={HomeworkLinkKind.GOOGLE_DOC}>Google Doc</option>
                <option value={HomeworkLinkKind.MIRO}>Miro Board</option>
                <option value={HomeworkLinkKind.YOUTUBE}>YouTube Video</option>
                <option value={HomeworkLinkKind.WORKSHEET}>Worksheet</option>
                <option value={HomeworkLinkKind.OTHER}>Other Link</option>
              </select>
            </div>
            <div className="sm:col-span-8">
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.homework.linkTitleMax}
                value={draftTitle}
                onChange={(e) => onDraftTitleChange(e.target.value)}
                placeholder="Link title (e.g., Fractions Worksheet Doc)"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              maxLength={BLUEPRINT_LIMITS.homework.linkUrlMax}
              value={draftUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://docs.google.com/... or https://miro.com/..."
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 border border-blue-200/80 dark:border-blue-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Link
            </button>
          </div>

          {linkError && (
            <p className="text-xs text-red-600 dark:text-red-400">{linkError}</p>
          )}
        </div>
      )}
    </div>
  );
}
