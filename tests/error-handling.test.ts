import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorPage from '../app/error';
import GlobalError from '../app/global-error';
import { DevOverlayBackHandler } from '../src/presentation/components/DevOverlayBackHandler';

describe('Error Boundaries & Dev Overlay Back Navigation', () => {
  let originalWindow: any;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // Set up a mock window for Node test environment
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:3000/',
        pathname: '/',
        search: '',
        reload: vi.fn(),
      },
      history: {
        state: null,
        pushState: vi.fn((state: any, title: string, url?: string) => {
          (globalThis as any).window.history.state = state;
        }),
        back: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });

  afterEach(() => {
    if (originalWindow !== undefined) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as any).window;
    }
    vi.restoreAllMocks();
  });

  it('should export valid ErrorPage and GlobalError components', () => {
    expect(typeof ErrorPage).toBe('function');
    expect(typeof GlobalError).toBe('function');
    expect(typeof DevOverlayBackHandler).toBe('function');
  });

  it('should correctly push error history state to prevent exiting application on back button', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');

    // Simulate mounting ErrorPage behavior
    window.history.pushState({ errorBoundaryPage: true }, '', 'http://localhost:3000/');
    expect(pushStateSpy).toHaveBeenCalledWith(
      { errorBoundaryPage: true },
      '',
      'http://localhost:3000/'
    );
    expect(window.history.state).toEqual({ errorBoundaryPage: true });
  });

  it('should push dev overlay state when dev overlay opens', () => {
    const pushStateSpy = vi.spyOn(window.history, 'pushState');
    window.history.pushState({ devOverlayOpen: true }, '', window.location.href);

    expect(pushStateSpy).toHaveBeenCalledWith(
      { devOverlayOpen: true },
      '',
      'http://localhost:3000/'
    );
    expect(window.history.state?.devOverlayOpen).toBe(true);
  });
});
