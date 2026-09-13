'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, X } from 'lucide-react';

/**
 * DevOverlayBackHandler
 *
 * Handles the Next.js development overlay (displayed when clicking the red "Issue" button).
 * 1. Pushes a history state when the dev overlay is opened so Chrome's browser back button
 *    returns to the application instead of exiting the page.
 * 2. Injects a high-priority "← Back to Application" button when the error overlay is open.
 * 3. Safely closes the overlay via Escape keyboard event and close button dispatch.
 */
export const DevOverlayBackHandler: React.FC = () => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  // Safely close the Next.js dev overlay
  const closeDevOverlay = useCallback(() => {
    // 1. Dispatch Escape keydown to document and active element
    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(escEvent);
    if (document.activeElement) {
      document.activeElement.dispatchEvent(escEvent);
    }

    // 2. Query nextjs-portal and click close buttons in its shadow root
    try {
      const portals = document.querySelectorAll('nextjs-portal');
      portals.forEach((portal) => {
        portal.dispatchEvent(escEvent);
        const shadow = portal.shadowRoot;
        if (shadow) {
          shadow.dispatchEvent(escEvent);
          const closeBtn = shadow.querySelector<HTMLElement>(
            'button[aria-label="Close"], [data-nextjs-dialog-close], button[data-close="true"], .dev-tools-close-button'
          );
          if (closeBtn) {
            closeBtn.click();
          }
        }
      });
    } catch {}

    setIsOverlayOpen(false);
  }, []);

  // Handle "Back to Application" action
  const handleBackToApp = useCallback(() => {
    closeDevOverlay();
    // If the history state was pushed by us, navigate back
    if (typeof window !== 'undefined' && window.history.state?.devOverlayOpen) {
      window.history.back();
    }
  }, [closeDevOverlay]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Handle Chrome browser Back button (popstate event)
    const handlePopState = (event: PopStateEvent) => {
      // Check if dev overlay or issue panel is open
      const portals = document.querySelectorAll('nextjs-portal');
      let hasOpenDialog = false;

      portals.forEach((portal) => {
        const shadow = portal.shadowRoot;
        if (shadow) {
          const dialog = shadow.querySelector('[role="dialog"], [data-nextjs-dialog], [data-rendered="true"]');
          if (dialog) hasOpenDialog = true;
        }
      });

      if (isOverlayOpen || hasOpenDialog || event.state?.devOverlayOpen) {
        // Intercept back button: close error overlay and keep user in the app!
        closeDevOverlay();
        // Prevent default exit behavior
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);

    // Watch for clicks on the red issue button or dev indicator
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Check if click was on or inside Next.js dev indicator / issue button
      const isNextPortal = target.closest('nextjs-portal') !== null;
      const isIssueButton =
        target.closest('.dev-tools-indicator-issue-count') !== null ||
        target.closest('[data-has-issues="true"]') !== null ||
        target.getAttribute?.('data-has-issues') === 'true' ||
        target.innerText?.toLowerCase().includes('issue');

      if (isNextPortal || isIssueButton) {
        // Push state so Chrome back button doesn't exit the app
        if (!window.history.state?.devOverlayOpen) {
          window.history.pushState({ devOverlayOpen: true }, '', window.location.href);
        }
        setIsOverlayOpen(true);
      }
    };

    document.addEventListener('click', handleGlobalClick, true);

    // MutationObserver to detect when the overlay appears or disappears
    const observer = new MutationObserver(() => {
      const portals = document.querySelectorAll('nextjs-portal');
      let foundOpenDialog = false;

      portals.forEach((portal) => {
        const shadow = portal.shadowRoot;
        if (shadow) {
          const dialog = shadow.querySelector(
            '[role="dialog"], [data-nextjs-dialog], [data-nextjs-terminal], .dev-tools-indicator-menu[data-rendered="true"]'
          );
          if (dialog) {
            foundOpenDialog = true;
          }
        }
      });

      if (foundOpenDialog && !isOverlayOpen) {
        setIsOverlayOpen(true);
        if (!window.history.state?.devOverlayOpen) {
          window.history.pushState({ devOverlayOpen: true }, '', window.location.href);
        }
      } else if (!foundOpenDialog && isOverlayOpen) {
        setIsOverlayOpen(false);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleGlobalClick, true);
      observer.disconnect();
    };
  }, [isOverlayOpen, closeDevOverlay]);

  if (!isOverlayOpen) return null;

  return (
    <div className="fixed top-4 left-4 z-[99999999] flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
      <button
        onClick={handleBackToApp}
        type="button"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-cyan-300 hover:text-cyan-200 font-bold text-xs border border-cyan-500/50 shadow-2xl backdrop-blur-xl transition-all active:scale-95 cursor-pointer"
        title="Close error overlay and return to application"
      >
        <ArrowLeft className="w-4 h-4 text-cyan-400" />
        <span>Back to Application</span>
      </button>

      <button
        onClick={closeDevOverlay}
        type="button"
        className="p-2.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 shadow-2xl backdrop-blur-xl transition-all cursor-pointer"
        title="Dismiss error overlay"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
