'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const handleBackToApp = useCallback(() => {
    try {
      sessionStorage.removeItem('midnight_last_error');
    } catch {}

    try {
      reset();
    } catch {}

    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, [reset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.history.pushState({ globalErrorPage: true }, '', window.location.href);

    const handlePopState = () => {
      handleBackToApp();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handleBackToApp]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 antialiased font-sans">
        <div className="w-full max-w-xl p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Application Error</h1>
            <p className="text-xs text-slate-400">
              A critical error occurred while loading the application interface.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left font-mono text-xs text-rose-300 break-words">
            {error.message || 'An unexpected error occurred.'}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleBackToApp}
              type="button"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Application</span>
            </button>

            <button
              onClick={() => reset()}
              type="button"
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
