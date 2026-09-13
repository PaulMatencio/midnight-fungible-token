'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, RefreshCw, AlertTriangle, Copy, Check, RotateCcw, ShieldAlert } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Return to application cleanly
  const handleBackToApp = useCallback(() => {
    try {
      // Clear any transient error flags in storage
      sessionStorage.removeItem('midnight_last_error');
    } catch {}

    try {
      // Attempt Next.js error boundary reset
      reset();
    } catch {}

    // Navigate to root or reload if already on root
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== '/' || window.location.search) {
        window.location.href = '/';
      } else {
        window.location.reload();
      }
    }
  }, [reset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Log the error for diagnostics
    console.error('[Application Error Boundary caught error]:', error);

    // Push state so Chrome browser's Back button routes back to application instead of exiting
    window.history.pushState({ errorBoundaryPage: true }, '', window.location.href);

    const handlePopState = () => {
      // Intercept Chrome Back button
      handleBackToApp();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [error, handleBackToApp]);

  const handleCopyError = () => {
    const text = `Error: ${error.message}\nDigest: ${error.digest || 'N/A'}\nStack:\n${error.stack || 'No stack trace available'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearCacheAndReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-12 relative overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header with Back Action */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-white text-sm shadow-md shadow-cyan-500/20">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">Midnight Fungible Token</h1>
            <p className="text-[11px] text-slate-400 font-mono">Application Error View</p>
          </div>
        </div>

        {/* Prominent Header Back Button */}
        <button
          onClick={handleBackToApp}
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 text-xs font-semibold border border-cyan-500/30 hover:border-cyan-500/60 shadow-lg shadow-cyan-950/40 transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
          <span>Back to Application</span>
        </button>
      </div>

      {/* Center Error Card */}
      <div className="w-full max-w-2xl mx-auto my-auto py-10 relative z-10">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl backdrop-blur-2xl space-y-6">
          {/* Status Header */}
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex-shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Contract / Runtime Issue
                </span>
                {error.digest && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {error.digest.slice(0, 8)}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                An error occurred while executing or rendering this action. You can return directly to the application dashboard or retry the operation.
              </p>
            </div>
          </div>

          {/* Error Message Box */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-rose-300 break-words leading-relaxed">
            {error.message || 'Unknown runtime error occurred.'}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            {/* Primary Back Button */}
            <button
              onClick={handleBackToApp}
              type="button"
              className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Application</span>
            </button>

            {/* Try Again Button */}
            <button
              onClick={() => reset()}
              type="button"
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700/80 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-slate-300" />
              <span>Try Again</span>
            </button>

            {/* Clear Cache & Restart */}
            <button
              onClick={handleClearCacheAndReset}
              type="button"
              className="px-3.5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
              title="Clear cached contract and wallet states and restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Cache</span>
            </button>
          </div>

          {/* Collapsible Technical Details */}
          <div className="pt-2 border-t border-slate-800/60">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="text-[11px] text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showDetails ? 'Hide Technical Details' : 'Show Technical Details'}
              </button>

              <button
                type="button"
                onClick={handleCopyError}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Error Details'}</span>
              </button>
            </div>

            {showDetails && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap leading-relaxed">
                {error.stack || 'No stack trace available.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Footer Info */}
      <div className="w-full max-w-4xl mx-auto pt-6 border-t border-slate-900 text-center text-xs text-slate-500 relative z-10">
        Tip: You can also use Chrome&apos;s browser Back button to return directly to the application dashboard.
      </div>
    </div>
  );
}
