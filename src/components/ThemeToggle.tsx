import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';

interface ThemeToggleProps {
  variant?: 'full' | 'compact';
  className?: string;
}

export function ThemeToggle({ variant = 'full', className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`inline-flex items-center justify-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors ${className}`}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-[#16213B] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1D2B4C] transition-colors whitespace-nowrap ${className}`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
        )}
        <span className="truncate">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </span>
      <span
        className={`inline-flex items-center w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
          isDark ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'
        }`}
        aria-hidden="true"
      >
        <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
      </span>
    </button>
  );
}
