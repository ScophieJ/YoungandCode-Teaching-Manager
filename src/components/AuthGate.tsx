import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { ThemeToggle } from './ThemeToggle';

export function AuthGate() {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing authentication.');
      } else if (code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#0A1020] relative overflow-hidden flex flex-col items-center justify-center p-6 transition-colors">
      {/* Subtle decorative ambient gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-28 w-96 h-96 rounded-full bg-blue-500/15 dark:bg-blue-500/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-28 w-96 h-96 rounded-full bg-violet-500/15 dark:bg-violet-500/10 blur-3xl"
      />

      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle variant="compact" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#131D33] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
        <div className="px-8 py-6 bg-gradient-to-br from-[#0F172A] via-[#1E3A8A] to-[#4338CA] text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                YoungAndCode
              </h1>
              <p className="text-xs font-medium text-blue-200">
                Teaching Manager · Math &amp; Technology
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            Private Teacher Workspace
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
            Sign in to manage Mathematics and Technology students, structured lesson
            plans, class documentation, AI-assisted reports, and homework.
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-6 text-xs">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
              <Users className="w-4 h-4 shrink-0" />
              <span className="font-medium">Student Profiles</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-violet-50/80 dark:bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-100 dark:border-violet-500/20">
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span className="font-medium">Lesson Planning</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-50/80 dark:bg-teal-500/10 text-teal-800 dark:text-teal-300 border border-teal-100 dark:border-teal-500/20">
              <ClipboardCheck className="w-4 h-4 shrink-0" />
              <span className="font-medium">Class Records</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-50/80 dark:bg-orange-500/10 text-orange-800 dark:text-orange-300 border border-orange-100 dark:border-orange-500/20">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="font-medium">AI Class Reports</span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm shadow-blue-600/25 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
          >
            <Lock className="w-4 h-4" />
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              Authenticated records are stored privately under your teacher account in Cloud Firestore.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
