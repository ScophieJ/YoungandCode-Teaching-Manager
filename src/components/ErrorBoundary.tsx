import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        displayMessage = `Database ${parsed.operationType ?? 'operation'} failed on ${parsed.path ?? 'workspace'}: ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: displayMessage };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#0A1020] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg">
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
