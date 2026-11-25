import type { User } from 'firebase/auth';
import {
  BookOpen,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { NavTab } from '../types/teaching';
import { getStudentInitials } from '../lib/uiTokens';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: User;
  onSignOut: () => Promise<void>;
  hasLiveClass?: boolean;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
  accentClass: string;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    accentClass: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'students',
    label: 'Students',
    icon: Users,
    accentClass: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'lesson-plans',
    label: 'Lesson Plans',
    icon: CalendarClock,
    accentClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'class-sessions',
    label: 'Class Documentation',
    icon: ClipboardCheck,
    accentClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'homework',
    label: 'Homework',
    icon: CheckSquare,
    accentClass: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'monthly-reports',
    label: 'Monthly Reports',
    icon: FileBarChart2,
    accentClass: 'text-emerald-600 dark:text-emerald-400',
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  user,
  onSignOut,
  hasLiveClass = false,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayName = user.displayName || user.email?.split('@')[0] || 'Teacher';
  const email = user.email || '';
  const initials = getStudentInitials(displayName);

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0F172A] border-r border-slate-200/90 dark:border-slate-800 transition-colors">
      <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-600/25">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="block text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
              YoungAndCode
            </span>
            <span className="block text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
              Math &amp; Tech Manager
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
                active
                  ? 'bg-gradient-to-r from-blue-50 via-indigo-50/80 to-violet-50/70 dark:from-blue-500/20 dark:via-indigo-500/15 dark:to-violet-500/10 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-200/80 dark:ring-blue-500/30'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? item.accentClass : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'class-sessions' && hasLiveClass && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-blue-600 text-white shrink-0">
                  Live
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        <ThemeToggle variant="full" />

        <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-slate-50/80 dark:bg-[#131D33] border border-slate-200/70 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-800 to-blue-700 dark:from-blue-600 dark:to-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </p>
            {email && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{email}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/70 rounded-xl border border-slate-200/90 dark:border-slate-700/80 transition-colors whitespace-nowrap disabled:opacity-60"
        >
          <LogOut className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Compact mobile top bar */}
      <header className="no-print lg:hidden sticky top-0 z-30 h-14 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap truncate">
            YoungAndCode
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle variant="compact" />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] h-full">
            {navContent}
          </aside>
        </div>
      )}

      {/* Desktop fixed sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>
    </>
  );
}
