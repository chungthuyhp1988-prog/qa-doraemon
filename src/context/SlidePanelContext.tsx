import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PanelEntry {
  id: string;
  component: React.ReactNode | (() => React.ReactNode);
  title?: string;
  icon?: React.ReactNode;
  url?: string;
  width?: number | string;
  className?: string;
  hideHeader?: boolean;
}

// Default & constraints for panel width
const DEFAULT_PANEL_WIDTH = 0; // 0 = auto (calc based on stack offset)
const MIN_PANEL_WIDTH = 400;
const PANEL_WIDTH_STORAGE_KEY = 'slide-panel-width';

interface SlidePanelContextType {
  /** Current stack of open panels (bottom → top) */
  panels: PanelEntry[];
  /** Push a new panel onto the stack. If a panel with the same `url` exists, focuses it instead. Returns its unique ID. */
  openPanel: (entry: Omit<PanelEntry, 'id'> & { id?: string }) => string;
  /** Replace the top-most panel with a new one (no animation gap) */
  replacePanel: (entry: Omit<PanelEntry, 'id'> & { id?: string }) => string;
  /** Close a specific panel by ID, or close the top-most panel if no ID given. Returns false if blocked. */
  closePanel: (id?: string) => boolean | undefined;
  /** Close ALL panels at once */
  closeAllPanels: () => void;
  /** Focus a panel by closing all panels above it in the stack */
  focusPanel: (id: string) => void;
  /** Whether any panel is currently open */
  hasOpenPanels: boolean;
  /** Set of panel IDs currently playing their exit animation */
  closingPanels: Set<string>;
  /** Lock panel to prevent accidental closure (e.g. when a form is open) */
  lockPanel: (id?: string) => void;
  /** Unlock panel to allow closure again */
  unlockPanel: (id?: string) => void;
  /** Whether the top-most panel is currently locked */
  isTopPanelLocked: boolean;
  /** Register a callback for when close is blocked on a locked panel */
  setOnCloseBlocked: (id: string | undefined, callback: (() => void) | null) => void;
  /** Force-close a panel (bypasses lock — used by discard/save handlers) */
  forceClosePanel: (id?: string) => void;
  /** User-set panel width in px (0 = auto) */
  panelWidth: number;
  /** Update panel width (from resize handle) */
  setPanelWidth: (width: number) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SlidePanelContext = createContext<SlidePanelContextType | null>(null);

let panelCounter = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadPersistedWidth(): number {
  try {
    const stored = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH) return parsed;
    }
  } catch { /* ignore */ }
  return DEFAULT_PANEL_WIDTH;
}

function persistWidth(width: number) {
  try {
    if (width > 0) {
      localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(width));
    } else {
      localStorage.removeItem(PANEL_WIDTH_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const SlidePanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [panels, setPanels] = useState<PanelEntry[]>([]);
  const [closingPanels, setClosingPanels] = useState<Set<string>>(new Set());
  const [lockedPanels, setLockedPanels] = useState<Set<string>>(new Set());
  const [panelWidth, setPanelWidthState] = useState<number>(loadPersistedWidth);
  const panelsRef = useRef(panels);
  const lockedRef = useRef(lockedPanels);
  const closeBlockedCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const [baseUrl, setBaseUrl] = useState<string>('');
  // Params that should be preserved regardless of panel state (e.g. ?tab=)
  const TAB_PARAMS = ['tab', 'view', 'dept', 'chart'];

  useEffect(() => {
    lockedRef.current = lockedPanels;
  }, [lockedPanels]);

  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  // Track URLs — sync panel state to URL search params
  useEffect(() => {
    if (panels.length === 0) {
      // All panels closed — restore base URL but KEEP current tab params
      if (baseUrl) {
        const restoredUrl = new URL(baseUrl, window.location.origin);
        // Merge current tab-related params so active tab is preserved
        const currentParams = new URLSearchParams(window.location.search);
        TAB_PARAMS.forEach(p => {
          const val = currentParams.get(p);
          if (val) restoredUrl.searchParams.set(p, val);
          else restoredUrl.searchParams.delete(p);
        });
        restoredUrl.searchParams.delete('panel');
        window.history.replaceState(null, '', restoredUrl.pathname + restoredUrl.search);
        setBaseUrl('');
      }
    } else {
      // Save base URL (without panel params) when first panel opens
      if (panels.length === 1 && !baseUrl) {
        // Store current path WITHOUT panel param
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('panel');
        setBaseUrl(currentUrl.pathname + currentUrl.search);
      }
      const activePanels = panels.filter(p => !closingPanels.has(p.id));
      const topPanel = activePanels[activePanels.length - 1];
      if (topPanel && topPanel.url) {
        // Extract panel ID from url (e.g., "/projects/DA-123" → "DA-123")
        const panelId = topPanel.url.split('/').pop() || '';
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('panel', panelId);
        window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search);
      }
    }
  }, [panels, closingPanels, baseUrl]);

  // ─── Panel width ──────────────────────────────────────────────
  const setPanelWidth = useCallback((width: number) => {
    const clamped = width <= 0 ? 0 : Math.max(MIN_PANEL_WIDTH, width);
    setPanelWidthState(clamped);
    persistWidth(clamped);
  }, []);

  // ─── Open panel (with duplicate prevention) ───────────────────
  const openPanel = useCallback((entry: Omit<PanelEntry, 'id'> & { id?: string }): string => {
    // Duplicate prevention: if a panel with the same url already exists, focus it
    if (entry.url) {
      const currentPanels = panelsRef.current;
      const existing = currentPanels.find(p => p.url === entry.url);
      if (existing) {
        // Focus the existing panel instead of opening a new one
        const idx = currentPanels.findIndex(p => p.id === existing.id);
        if (idx < currentPanels.length - 1) {
          // Not already on top — close panels above it
          const panelsAbove = currentPanels.slice(idx + 1);
          const hasLocked = panelsAbove.some(p => lockedRef.current.has(p.id));
          if (!hasLocked) {
            const idsToClose = panelsAbove.map(p => p.id);
            setClosingPanels(prev => new Set([...prev, ...idsToClose]));
            setTimeout(() => {
              setPanels(prev => prev.filter(p => !idsToClose.includes(p.id)));
              setClosingPanels(prev => {
                const next = new Set(prev);
                idsToClose.forEach(i => next.delete(i));
                return next;
              });
            }, 220);
          }
        }
        return existing.id;
      }
    }

    const id = entry.id ?? `panel-${++panelCounter}-${Date.now()}`;
    setPanels(prev => [...prev, { ...entry, id }]);
    return id;
  }, []);

  // ─── Replace top panel ────────────────────────────────────────
  const replacePanel = useCallback((entry: Omit<PanelEntry, 'id'> & { id?: string }): string => {
    const id = entry.id ?? `panel-${++panelCounter}-${Date.now()}`;
    setPanels(prev => {
      if (prev.length === 0) return [{ ...entry, id }];
      // Replace the last panel
      const rest = prev.slice(0, -1);
      return [...rest, { ...entry, id }];
    });
    return id;
  }, []);

  const triggerCloseAnimation = useCallback((id: string) => {
    setClosingPanels(prev => new Set(prev).add(id));
    setTimeout(() => {
      setPanels(prev => prev.filter(p => p.id !== id));
      setClosingPanels(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 220);
  }, []);

  const closePanel = useCallback((id?: string) => {
    const currentPanels = panelsRef.current;
    if (currentPanels.length === 0) return;
    // Chỉ chấp nhận id là chuỗi (string) hợp lệ, lọc bỏ các sự kiện MouseEvent do React onClick truyền sang
    const targetId = (typeof id === 'string' && id) ? id : currentPanels[currentPanels.length - 1].id;
    if (lockedRef.current.has(targetId)) {
      const cb = closeBlockedCallbacksRef.current.get(targetId);
      if (cb) cb();
      return false;
    }
    triggerCloseAnimation(targetId);
    return true;
  }, [triggerCloseAnimation]);

  const forceClosePanel = useCallback((id?: string) => {
    const currentPanels = panelsRef.current;
    if (currentPanels.length === 0) return;
    const targetId = id || currentPanels[currentPanels.length - 1].id;
    setLockedPanels(prev => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    closeBlockedCallbacksRef.current.delete(targetId);
    triggerCloseAnimation(targetId);
  }, [triggerCloseAnimation]);

  const lockPanel = useCallback((id?: string) => {
    const currentPanels = panelsRef.current;
    if (currentPanels.length === 0) return;
    const targetId = id || currentPanels[currentPanels.length - 1].id;
    setLockedPanels(prev => new Set(prev).add(targetId));
  }, []);

  const unlockPanel = useCallback((id?: string) => {
    const currentPanels = panelsRef.current;
    if (currentPanels.length === 0) return;
    const targetId = id || currentPanels[currentPanels.length - 1].id;
    setLockedPanels(prev => {
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
  }, []);

  const closeAllPanels = useCallback(() => {
    const currentPanels = panelsRef.current;
    if (currentPanels.length === 0) return;
    const hasLocked = currentPanels.some(p => lockedRef.current.has(p.id));
    if (hasLocked) return;

    const idsToClose = currentPanels.map(p => p.id);
    setClosingPanels(prev => new Set([...prev, ...idsToClose]));

    setTimeout(() => {
      setPanels([]);
      setClosingPanels(new Set());
    }, 220);
  }, []);

  const focusPanel = useCallback((id: string) => {
    const currentPanels = panelsRef.current;
    const idx = currentPanels.findIndex(p => p.id === id);
    if (idx === -1) return;

    const panelsToClose = currentPanels.slice(idx + 1);
    if (panelsToClose.length === 0) return;
    const hasLocked = panelsToClose.some(p => lockedRef.current.has(p.id));
    if (hasLocked) return;

    const idsToClose = panelsToClose.map(p => p.id);
    setClosingPanels(prev => new Set([...prev, ...idsToClose]));

    setTimeout(() => {
      setPanels(prev => prev.filter(p => !idsToClose.includes(p.id)));
      setClosingPanels(prev => {
        const next = new Set(prev);
        idsToClose.forEach(i => next.delete(i));
        return next;
      });
    }, 220);
  }, []);

  const hasOpenPanels = panels.length > 0;
  const isTopPanelLocked = useMemo(() => {
    if (panels.length === 0) return false;
    return lockedPanels.has(panels[panels.length - 1].id);
  }, [panels, lockedPanels]);

  // Clean up locks and callbacks for panels that no longer exist
  useEffect(() => {
    const panelIds = new Set(panels.map(p => p.id));
    setLockedPanels(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (panelIds.has(id)) next.add(id); });
      return next.size === prev.size ? prev : next;
    });
    closeBlockedCallbacksRef.current.forEach((_, id) => {
      if (!panelIds.has(id)) closeBlockedCallbacksRef.current.delete(id);
    });
  }, [panels]);

  const setOnCloseBlocked = useCallback((id: string | undefined, callback: (() => void) | null) => {
    const currentPanels = panelsRef.current;
    if (currentPanels.length === 0) return;
    const targetId = id || currentPanels[currentPanels.length - 1].id;
    if (callback) {
      closeBlockedCallbacksRef.current.set(targetId, callback);
    } else {
      closeBlockedCallbacksRef.current.delete(targetId);
    }
  }, []);

  const value = useMemo(() => ({
    panels,
    openPanel,
    replacePanel,
    closePanel,
    closeAllPanels,
    focusPanel,
    hasOpenPanels,
    closingPanels,
    lockPanel,
    unlockPanel,
    isTopPanelLocked,
    setOnCloseBlocked,
    forceClosePanel,
    panelWidth,
    setPanelWidth,
  }), [panels, openPanel, replacePanel, closePanel, closeAllPanels, focusPanel, hasOpenPanels, closingPanels, lockPanel, unlockPanel, isTopPanelLocked, setOnCloseBlocked, forceClosePanel, panelWidth, setPanelWidth]);

  return (
    <SlidePanelContext.Provider value={value}>
      {children}
    </SlidePanelContext.Provider>
  );
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSlidePanel() {
  const ctx = useContext(SlidePanelContext);
  if (!ctx) {
    throw new Error('useSlidePanel must be used within a SlidePanelProvider');
  }
  return ctx;
}

export function useSlidePanelSafe() {
  return useContext(SlidePanelContext);
}

export default SlidePanelContext;
