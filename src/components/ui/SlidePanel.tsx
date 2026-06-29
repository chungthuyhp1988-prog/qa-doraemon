import React, { useEffect, useCallback, useRef, useState } from 'react';
import { X, FileText, Layers, GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useSlidePanel, PanelEntry } from '../../context/SlidePanelContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_GAP = 20;           // px base gap between sidebar and first panel (expanded)
const COLLAPSED_BASE_GAP = 60; // px base gap when sidebar collapsed (larger to prevent tab clipping)
const STACKING_OFFSET = 20;   // px additional gap per stacked panel
const TAB_WIDTH = 34;          // px tab thickness (protrudes left of panel edge)
const TAB_LENGTH = 148;        // px fixed tab length (vertical)
const TAB_GAP = 3;             // px gap between adjacent tabs
const MIN_PANEL_WIDTH = 400;   // minimum panel width in px
const SWIPE_THRESHOLD = 100;   // px to trigger swipe-to-close

// ─── Resize Handle ───────────────────────────────────────────────────────────

interface ResizeHandleProps {
  onResizeStart: (startX: number) => void;
  onResetWidth: () => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResizeStart, onResetWidth }) => {
  return (
    <div
      className="slide-panel-resize-handle group/resize"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeStart(e.clientX);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        onResetWidth();
      }}
      title="Kéo để thay đổi kích thước • Nhấp đúp để đặt lại"
    >
      <div className="slide-panel-resize-indicator">
        <GripVertical size={12} className="text-on-surface-variant/40 opacity-0 group-hover/resize:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

// ─── Panel Title Bar ─────────────────────────────────────────────────────────

interface PanelTitleBarProps {
  panel: PanelEntry;
  onClose: () => void;
  panelWidth: number;
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
}

const PanelTitleBar: React.FC<PanelTitleBarProps> = ({ panel, onClose, panelWidth, onToggleMaximize, isMaximized }) => {
  const isNarrow = panelWidth > 0 && panelWidth < 500;
  return (
    <div className="slide-panel-title-bar">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="slide-panel-title-icon">
          {panel.icon || <FileText size={14} />}
        </span>
        <h3 className={`slide-panel-title-text ${isNarrow ? 'max-w-[180px]' : 'max-w-[400px]'}`}>
          {panel.title || 'Chi tiết'}
        </h3>
      </div>
      <div className="flex items-center gap-1">
        {onToggleMaximize && (
          <button
            onClick={onToggleMaximize}
            className="slide-panel-title-btn"
            aria-label={isMaximized ? 'Thu nhỏ' : 'Phóng to'}
            title={isMaximized ? 'Thu nhỏ' : 'Phóng to'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        <button
          onClick={onClose}
          className="slide-panel-title-btn slide-panel-title-btn-close"
          aria-label="Đóng"
          title="Đóng (Esc)"
        >
          <X size={15} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

// ─── Single Panel ────────────────────────────────────────────────────────────

interface SlidePanelItemProps {
  panel: PanelEntry;
  index: number;
  total: number;
  onClose: () => void;
  isExiting?: boolean;
  panelWidth: number;
  isResizing: boolean;
  onResizeStart?: (startX: number) => void;
  onResetWidth?: () => void;
  isSidebarCollapsed: boolean;
  onLeftEdgeChange: (id: string, left: number) => void;
}

const SlidePanelItem: React.FC<SlidePanelItemProps> = ({
  panel, index, total, onClose, isExiting, panelWidth, isResizing,
  onResizeStart, onResetWidth, isSidebarCollapsed, onLeftEdgeChange,
}) => {
  const isTopPanel = index === total - 1;
  const baseGap = isSidebarCollapsed ? COLLAPSED_BASE_GAP : BASE_GAP;
  const stackOffset = baseGap + index * STACKING_OFFSET;
  const [isMaximized, setIsMaximized] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!elementRef.current) return;
    const observer = new ResizeObserver(() => {
      const rect = elementRef.current?.getBoundingClientRect();
      if (rect) {
        onLeftEdgeChange(panel.id, rect.left);
      }
    });
    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [panel.id, onLeftEdgeChange]);

  // Swipe-to-close state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || !isTopPanel) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // Only track horizontal swipes (right direction)
    if (deltaX > 10 && deltaX > deltaY) {
      setSwipeOffset(Math.max(0, deltaX));
    }
  }, [isTopPanel]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;
    if (swipeOffset > SWIPE_THRESHOLD) {
      onClose();
    }
    setSwipeOffset(0);
    touchStartRef.current = null;
  }, [swipeOffset, onClose]);

  // Compute width style: user-resized width (panelWidth) overrides panel.width
  const initialWidth = panel.width
    ? (typeof panel.width === 'number' ? `${panel.width}px` : panel.width)
    : `calc(50% - ${stackOffset}px)`;
  const widthValue = (isTopPanel && panelWidth > 0) ? `${panelWidth}px` : initialWidth;

  const widthStyle: React.CSSProperties = isMaximized
    ? {
        width: '100%',
        maxWidth: '100%',
      }
    : {
        width: widthValue,
        maxWidth: `calc(100% - ${stackOffset}px)`,
      };

  return (
    <div
      className="absolute inset-0 flex justify-end"
      style={{ zIndex: 45 + index }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className={`absolute inset-0 transition-colors duration-200 ${isTopPanel
          ? 'bg-black/2 dark:bg-black/10 cursor-pointer'
          : 'bg-transparent pointer-events-none'
          }`}
        onClick={isTopPanel ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel Wrapper */}
      <motion.div
        ref={elementRef}
        initial={{ x: '100%', opacity: 0.5 }}
        animate={{ x: isExiting ? '100%' : '0%', opacity: isExiting ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="slide-panel-wrapper relative h-full flex flex-col"
        style={{
          ...widthStyle,
          ...(swipeOffset > 0 ? {
            transform: `translateX(${swipeOffset}px)`,
            opacity: Math.max(0.3, 1 - swipeOffset / 400),
            transition: 'none',
          } : {}),
        }}
      >
        {/* Resize handle */}
        {isTopPanel && !isMaximized && !isExiting && onResizeStart && onResetWidth && (
          <ResizeHandle
            onResizeStart={onResizeStart}
            onResetWidth={onResetWidth}
          />
        )}

        {/* Actual Panel Body */}
        <div
          className={`relative w-full h-full bg-surface border-l border-outline-variant/40
            flex flex-col overflow-hidden slide-panel-stacked
            ${isResizing ? 'slide-panel-resizing' : ''} ${panel.className || ''}`}
          style={isTopPanel ? {} : { filter: 'brightness(0.97)' }}
          role="dialog"
          aria-modal={isTopPanel}
          aria-label={panel.title || 'Panel'}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Title Bar */}
          {isTopPanel && !panel.hideHeader && (
            <PanelTitleBar
              panel={panel}
              onClose={onClose}
              panelWidth={panelWidth}
              onToggleMaximize={() => setIsMaximized(prev => !prev)}
              isMaximized={isMaximized}
            />
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {typeof panel.component === 'function'
              ? (panel.component as () => React.ReactNode)()
              : panel.component}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Tab Ears ────────────────────────────────────────────────────────────────

interface PanelTabsOverlayProps {
  panels: PanelEntry[];
  sidebarWidth: number;
  isSidebarCollapsed: boolean;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onCloseAll: () => void;
  panelLefts: Record<string, number>;
}

const PanelTabsOverlay: React.FC<PanelTabsOverlayProps> = ({ panels, sidebarWidth, isSidebarCollapsed, onFocus, onClose, onCloseAll, panelLefts }) => {
  if (panels.length === 0) return null;

  return (
    <>
      {panels.map((panel, index) => {
        const isTopPanel = index === panels.length - 1;
        const title = panel.title || `Panel ${index + 1}`;
        const displayTitle = title.length > 24 ? title.slice(0, 24) + '…' : title;

        const tabTop = index * (TAB_LENGTH + TAB_GAP);

        const measuredLeft = panelLefts[panel.id];
        const panelLeftEdgeScreen = measuredLeft !== undefined 
          ? measuredLeft 
          : (sidebarWidth + (isSidebarCollapsed ? COLLAPSED_BASE_GAP : BASE_GAP) + index * STACKING_OFFSET);

        return (
          <div
            key={panel.id}
            className="slide-panel-tab pointer-events-auto absolute hidden md:block"
            style={{
              right: `calc(100% - ${panelLeftEdgeScreen + 1}px)`,
              top: `${tabTop}px`,
              zIndex: 45 + panels.length + index + 1,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isTopPanel) {
                  onFocus(panel.id);
                }
              }}
              className={`group flex flex-col items-center gap-1.5 pt-2.5 pb-2
                rounded-l-xl border border-r-0
                transition-all duration-200
                ${isTopPanel
                  ? 'bg-primary text-white border-primary shadow-xl shadow-primary/30'
                  : 'bg-surface border-outline-variant text-on-surface-variant hover:bg-primary-container hover:text-primary hover:border-primary/50 shadow-sm cursor-pointer'
                }`}
              style={{ width: `${TAB_WIDTH}px`, height: `${TAB_LENGTH}px` }}
              title={panel.title || 'Panel'}
            >
              {/* Icon */}
              <span className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${isTopPanel
                ? 'text-white/80'
                : 'text-on-surface-variant/60'
                }`}>
                {panel.icon || <FileText size={14} />}
              </span>

              {/* Title */}
              <span
                className="flex-1 min-h-0 overflow-hidden text-xs font-semibold whitespace-nowrap"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textOverflow: 'ellipsis' }}
              >
                {displayTitle}
              </span>

              {/* Close button */}
              {isTopPanel && (
                <span
                  onClick={(e) => { e.stopPropagation(); onClose(panel.id); }}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center
                    rounded-full
                    text-white/80 hover:text-white hover:bg-primary/20
                    transition-all duration-150 cursor-pointer"
                  title="Đóng"
                >
                  <X size={12} strokeWidth={2.5} />
                </span>
              )}
            </button>
          </div>
        );
      })}

      {/* "Close All" button */}
      {panels.length > 1 && (
        <div
          className="slide-panel-tab pointer-events-auto absolute hidden md:block"
          style={{
            right: `calc(100% - ${(panelLefts[panels[panels.length - 1].id] !== undefined ? panelLefts[panels[panels.length - 1].id] : (sidebarWidth + (isSidebarCollapsed ? COLLAPSED_BASE_GAP : BASE_GAP) + (panels.length - 1) * STACKING_OFFSET)) + 1}px)`,
            top: `${panels.length * (TAB_LENGTH + TAB_GAP) + 8}px`,
            zIndex: 45 + panels.length * 2 + 2,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseAll();
            }}
            className="group flex flex-col items-center gap-1.5 pt-2.5 pb-2
              rounded-l-xl border border-r-0
              bg-error-container border-error/20
              text-error
              hover:bg-error/10 hover:text-error
              shadow-lg shadow-black/5
              transition-all duration-200"
            style={{ width: `${TAB_WIDTH}px` }}
            title="Đóng tất cả panel"
          >
            <Layers size={14} className="flex-shrink-0" />
            <span 
              className="flex-1 min-h-0 overflow-hidden text-xs font-semibold whitespace-nowrap"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Đóng tất cả
            </span>
          </button>
        </div>
      )}
    </>
  );
};

// ─── Panel Container ─────────────────────────────────────────────────────────

interface SlidePanelContainerProps {
  isSidebarCollapsed: boolean;
}

export const SlidePanelContainer: React.FC<SlidePanelContainerProps> = ({ isSidebarCollapsed }) => {
  const {
    panels, closePanel, closeAllPanels, focusPanel, hasOpenPanels,
    closingPanels, isTopPanelLocked, panelWidth, setPanelWidth,
  } = useSlidePanel();

  const [panelLefts, setPanelLefts] = useState<Record<string, number>>({});

  const handleLeftEdgeChange = useCallback((id: string, left: number) => {
    setPanelLefts(prev => {
      if (prev[id] === left) return prev;
      return { ...prev, [id]: left };
    });
  }, []);

  useEffect(() => {
    const openIds = new Set(panels.map(p => p.id));
    setPanelLefts(prev => {
      const next = { ...prev };
      let changed = false;
      for (const id in next) {
        if (!openIds.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [panels]);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const panelViewportRef = useRef<HTMLDivElement>(null);

  // Focus trap
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const guardedClose = useCallback((id?: string) => {
    closePanel(id);
  }, [closePanel]);

  const guardedFocus = useCallback((id: string) => {
    if (isTopPanelLocked) {
      closePanel();
      return;
    }
    focusPanel(id);
  }, [focusPanel, isTopPanelLocked, closePanel]);

  // Keyboard: Escape to close
  useEffect(() => {
    if (!hasOpenPanels) return;
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        guardedClose();
      }
    };
    window.addEventListener('keydown', handleEscapeKey, { capture: true });
    return () => window.removeEventListener('keydown', handleEscapeKey, { capture: true });
  }, [hasOpenPanels, guardedClose]);

  // Focus management
  useEffect(() => {
    if (hasOpenPanels) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.classList.add('slide-panel-open');

      const timer = setTimeout(() => {
        if (panelViewportRef.current) {
          const firstFocusable = panelViewportRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          firstFocusable?.focus();
        }
      }, 300);
      return () => {
        clearTimeout(timer);
        document.body.classList.remove('slide-panel-open');
      };
    } else {
      document.body.classList.remove('slide-panel-open');
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }
  }, [hasOpenPanels]);

  // Resize mouse move/up handlers
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = resizeStartRef.current.startX - e.clientX;
      const newWidth = resizeStartRef.current.startWidth + delta;
      const maxWidth = window.innerWidth * 0.95;
      const clamped = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, newWidth));
      setPanelWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, setPanelWidth]);

  const handleResizeStart = useCallback((startX: number) => {
    const currentWidth = panelWidth > 0
      ? panelWidth
      : (panelViewportRef.current?.querySelector<HTMLElement>('[role="dialog"]')?.offsetWidth || window.innerWidth * 0.7);
    resizeStartRef.current = { startX, startWidth: currentWidth };
    setIsResizing(true);
  }, [panelWidth]);

  const handleResetWidth = useCallback(() => {
    setPanelWidth(0);
  }, [setPanelWidth]);

  if (!hasOpenPanels) return null;

  const sidebarWidth = isSidebarCollapsed ? 72 : 280; // w-[72px] vs w-[280px]
  const isAllExiting = panels.length > 0 && closingPanels.size === panels.length;

  return (
    <div className="fixed inset-0 z-[45] overflow-hidden">
      {/* Full-screen backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isAllExiting ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-black/10 dark:bg-black/35 backdrop-blur-xs transition-colors duration-200"
        onClick={() => guardedClose()}
        aria-hidden="true"
      />

      {/* Panel viewport */}
      <style>{`
        @media (min-width: 768px) {
          .slide-panel-viewport {
            left: ${sidebarWidth}px !important;
          }
        }
      `}</style>
      <div
        ref={panelViewportRef}
        className="slide-panel-viewport absolute inset-0 overflow-y-hidden overflow-x-visible"
        style={{ left: 0 }}
      >
        {panels.map((panel, index) => (
          <SlidePanelItem
            key={panel.id}
            panel={panel}
            index={index}
            total={panels.length}
            onClose={() => guardedClose(panel.id)}
            isExiting={closingPanels.has(panel.id)}
            panelWidth={panelWidth}
            isResizing={isResizing}
            onResizeStart={handleResizeStart}
            onResetWidth={handleResetWidth}
            isSidebarCollapsed={isSidebarCollapsed}
            onLeftEdgeChange={handleLeftEdgeChange}
          />
        ))}
      </div>

      {/* Tab Ears */}
      <PanelTabsOverlay
        panels={panels}
        sidebarWidth={sidebarWidth}
        isSidebarCollapsed={isSidebarCollapsed}
        onFocus={(id) => guardedFocus(id)}
        onClose={(id) => guardedClose(id)}
        onCloseAll={closeAllPanels}
        panelLefts={panelLefts}
      />
    </div>
  );
};

export default SlidePanelContainer;
