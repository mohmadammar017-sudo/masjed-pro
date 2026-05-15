import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DuaDisplaySlot, PrayerSettings } from '../types';
import { normalizeRamadanDuaSystemSettings } from '../data/ramadanDuaLibrary';
import { useRamadanDuaPlayback } from '../hooks/useRamadanDuaPlayback';
import '../styles/ramadan-dua-display.css';

interface RamadanDuasViewProps {
  onExit: () => void;
  onBack?: () => void;
  settings?: PrayerSettings;
  forcedDuaId?: string | null;
  contextSlot?: DuaDisplaySlot | null;
  previewMode?: boolean;
  controlScheme?: 'legacy' | 'presenter';
}

interface DuaPage {
  start: number;
  end: number;
  items: Array<{ index: number; text: string }>;
}

const toRgba = (color: string, alpha: number): string => {
  const normalized = (color || '').trim();
  if (/^#([0-9a-f]{3}){1,2}$/i.test(normalized)) {
    const hex = normalized.slice(1);
    const values =
      hex.length === 3
        ? hex.split('').map((part) => parseInt(part + part, 16))
        : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((part) => parseInt(part, 16));
    return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${alpha})`;
  }

  return normalized || `rgba(7, 17, 31, ${alpha})`;
};

const buildPages = (lines: string[], fontScale: number): DuaPage[] => {
  if (lines.length === 0) return [];

  const pages: DuaPage[] = [];
  const maxUnits =
    fontScale >= 1.7 ? 6
    : fontScale >= 1.5 ? 7
    : fontScale >= 1.3 ? 8
    : fontScale >= 1.1 ? 10
    : fontScale >= 0.95 ? 12
    : 15;
  const maxItems =
    fontScale >= 1.7 ? 3
    : fontScale >= 1.5 ? 4
    : fontScale >= 1.3 ? 5
    : fontScale >= 1.1 ? 6
    : fontScale >= 0.95 ? 7
    : 10;

  let start = 0;
  let currentItems: DuaPage['items'] = [];
  let currentUnits = 0;

  const flush = () => {
    if (currentItems.length === 0) return;
    pages.push({
      start,
      end: currentItems[currentItems.length - 1].index,
      items: currentItems
    });
    currentItems = [];
    currentUnits = 0;
  };

  lines.forEach((line, index) => {
    const weight = Math.min(4, Math.max(1, Math.ceil((line.length * Math.max(fontScale, 1)) / 40)));
    const exceedsCapacity = currentItems.length > 0 && (currentUnits + weight > maxUnits || currentItems.length >= maxItems);

    if (exceedsCapacity) {
      flush();
      start = index;
    }

    if (currentItems.length === 0) {
      start = index;
    }

    currentItems.push({ index, text: line });
    currentUnits += weight;
  });

  flush();
  return pages;
};

const samePages = (left: DuaPage[], right: DuaPage[]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((page, index) => {
    const other = right[index];
    if (!other || page.start !== other.start || page.end !== other.end || page.items.length !== other.items.length) {
      return false;
    }
    return page.items.every((item, itemIndex) => item.index === other.items[itemIndex]?.index && item.text === other.items[itemIndex]?.text);
  });
};

const RamadanDuasView: React.FC<RamadanDuasViewProps> = ({
  onExit,
  onBack,
  settings,
  forcedDuaId = null,
  contextSlot = null,
  previewMode = false,
  controlScheme = 'legacy'
}) => {
  const duaSettings = useMemo(
    () => normalizeRamadanDuaSystemSettings(settings?.ramadanDuaSystem),
    [settings?.ramadanDuaSystem]
  );
  const fontScale = Math.max(0.8, Math.min(1.8, duaSettings.fontScale || 1));
  const chunkCharLimit =
    fontScale >= 1.7 ? 24
    : fontScale >= 1.5 ? 28
    : fontScale >= 1.3 ? 32
    : fontScale >= 1.1 ? 38
    : fontScale >= 0.95 ? 46
    : 54;

  const {
    playlist,
    currentDua,
    lines,
    lineIndex,
    duaIndex,
    jumpToLine,
    goToNextDua,
    goToPreviousDua
  } = useRamadanDuaPlayback({
    duas: duaSettings.duas,
    order: duaSettings.duaOrder,
    forcedDuaId,
    contextSlot,
    chunkCharLimit,
    autoRotate: duaSettings.autoRotate,
    advanceMode: 'manual',
    lineDurationSec: duaSettings.displayDurationSec,
    enabled: duaSettings.enabled || previewMode
  });
  const estimatedPages = useMemo(() => buildPages(lines, fontScale), [lines, fontScale]);
  const [pages, setPages] = useState<DuaPage[]>(estimatedPages);
  const copyBodyRef = useRef<HTMLDivElement | null>(null);
  const pageFrameRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const measureTextRef = useRef<HTMLParagraphElement | null>(null);
  const textFlowRef = useRef<HTMLSpanElement | null>(null);
  const pendingHighlightAnchorRef = useRef<'first' | 'last'>('first');
  const [layoutTick, setLayoutTick] = useState(0);
  const [paginationSafetyLevel, setPaginationSafetyLevel] = useState(0);
  const [visualLines, setVisualLines] = useState<Array<{ top: number; height: number; width: number; left: number }>>([]);
  const activePageIndex = useMemo(() => {
    if (pages.length === 0) return 0;
    const foundIndex = pages.findIndex((page) => lineIndex >= page.start && lineIndex <= page.end);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [lineIndex, pages]);
  const activePage = pages[activePageIndex];
  const pageSignature = activePage?.items.map((item) => `${item.index}:${item.text}`).join(' | ') || '';
  const [direction, setDirection] = useState<1 | -1>(1);
  const previousLineIndexRef = useRef(lineIndex);
  const readingBarEnabled = duaSettings.showReadingBar;
  const pageNavigationMode = !readingBarEnabled;
  const [activeVisualLineIndex, setActiveVisualLineIndex] = useState(0);

  useEffect(() => {
    const target = copyBodyRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      setLayoutTick((prev) => prev + 1);
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fontSet) return;

    let cancelled = false;
    const refreshLayout = () => {
      if (cancelled) return;
      setLayoutTick((prev) => prev + 1);
    };

    fontSet.ready.then(refreshLayout).catch(() => {});
    fontSet.addEventListener?.('loadingdone', refreshLayout);

    return () => {
      cancelled = true;
      fontSet.removeEventListener?.('loadingdone', refreshLayout);
    };
  }, []);

  useEffect(() => {
    setPaginationSafetyLevel(0);
  }, [currentDua?.id, fontScale, lines.length]);

  useLayoutEffect(() => {
    const host = copyBodyRef.current;
    const measure = measureRef.current;
    const measureText = measureTextRef.current;

    if (!host || !measure || !measureText || host.clientWidth === 0 || host.clientHeight === 0) {
      setPages((prev) => (samePages(prev, estimatedPages) ? prev : estimatedPages));
      return;
    }

    const measuredTextWidth = Math.max(1, Math.floor(host.clientWidth * 0.95));
    measure.style.width = `${measuredTextWidth}px`;

    const frameStyle = pageFrameRef.current ? window.getComputedStyle(pageFrameRef.current) : null;
    const framePaddingTop = frameStyle ? Number.parseFloat(frameStyle.paddingTop || '0') || 0 : 0;
    const framePaddingBottom = frameStyle ? Number.parseFloat(frameStyle.paddingBottom || '0') || 0 : 0;
    const availableHeight = Math.max(1, host.clientHeight - framePaddingTop - framePaddingBottom);
    const baseOverflowBuffer = Math.max(42, Math.round(fontScale * 24));
    const overflowBuffer = baseOverflowBuffer + paginationSafetyLevel * 18;

    const nextPages: DuaPage[] = [];
    let currentItems: DuaPage['items'] = [];
    let start = 0;

    const renderMeasure = (items: DuaPage['items']) => {
      measureText.innerHTML = '';
      items.forEach((item, index) => {
        const span = document.createElement('span');
        span.className = 'ramadan-viewer-text-line ramadan-viewer-text-line--measure';
        span.textContent = item.text;
        measureText.appendChild(span);
        if (index < items.length - 1) {
          measureText.appendChild(document.createTextNode(' '));
        }
      });
    };

    lines.forEach((text, index) => {
      const candidate = [...currentItems, { index, text }];
      renderMeasure(candidate);
      const overflowing = measureText.scrollHeight > Math.max(1, availableHeight - overflowBuffer);

      if (overflowing && currentItems.length > 0) {
        nextPages.push({
          start,
          end: currentItems[currentItems.length - 1].index,
          items: currentItems
        });
        currentItems = [{ index, text }];
        start = index;
        renderMeasure(currentItems);
        return;
      }

      if (currentItems.length === 0) {
        start = index;
      }

      currentItems = candidate;
    });

    if (currentItems.length > 0) {
      nextPages.push({
        start,
        end: currentItems[currentItems.length - 1].index,
        items: currentItems
      });
    }

    const resolvedPages = nextPages.length > 0 ? nextPages : estimatedPages;
    setPages((prev) => (samePages(prev, resolvedPages) ? prev : resolvedPages));
  }, [estimatedPages, fontScale, layoutTick, lines, paginationSafetyLevel]);

  useLayoutEffect(() => {
    const frame = pageFrameRef.current;
    if (!frame || !currentDua) return;

    const rafId = window.requestAnimationFrame(() => {
      const hasOverflow = frame.scrollHeight > frame.clientHeight + 2;
      if (hasOverflow) {
        setPaginationSafetyLevel((prev) => Math.min(prev + 1, 8));
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activePageIndex, currentDua, pageSignature]);

  useEffect(() => {
    const host = pageFrameRef.current;
    const flow = textFlowRef.current;
    if (!host || !flow || !readingBarEnabled) {
      setVisualLines([]);
      return;
    }
    setVisualLines([]);

    const frameId = window.requestAnimationFrame(() => {
      const hostRect = host.getBoundingClientRect();
      const rects = Array.from(flow.getClientRects())
        .map((rect) => ({
          top: rect.top - hostRect.top,
          left: rect.left - hostRect.left,
          width: rect.width,
          height: rect.height
        }))
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top));

      const mergedRects = rects.reduce<Array<{ top: number; height: number; width: number; left: number }>>((acc, rect) => {
        const previous = acc[acc.length - 1];
        if (previous && Math.abs(previous.top - rect.top) <= 4) {
          const mergedLeft = Math.min(previous.left, rect.left);
          const mergedRight = Math.max(previous.left + previous.width, rect.left + rect.width);
          previous.left = mergedLeft;
          previous.width = mergedRight - mergedLeft;
          previous.height = Math.max(previous.height, rect.height);
          previous.top = Math.min(previous.top, rect.top);
          return acc;
        }

        acc.push({
          top: rect.top,
          height: rect.height,
          width: rect.width,
          left: rect.left
        });
        return acc;
      }, []);

      const merged = mergedRects.map((rect) => {
        const containerWidth = host.clientWidth;
        const horizontalPadding = Math.min(68, Math.max(30, containerWidth * 0.045));
        const desiredWidth = Math.max(rect.width + horizontalPadding * 1.45, containerWidth * 0.72);
        const barWidth = Math.min(Math.max(containerWidth - horizontalPadding * 2, 0), desiredWidth);
        const topInset = Math.max(3, Math.round(rect.height * 0.16));
        const bottomInset = Math.max(2, Math.round(rect.height * 0.08));
        const barHeight = Math.max(18, rect.height - topInset - bottomInset);

        return {
          top: rect.top + topInset + 1,
          height: barHeight,
          width: barWidth,
          left: (containerWidth - barWidth) / 2
        };
      });

      setVisualLines((prev) => {
        if (prev.length === merged.length && prev.every((line, index) => {
          const other = merged[index];
          return (
            other &&
            Math.abs(line.top - other.top) < 1 &&
            Math.abs(line.height - other.height) < 1 &&
            Math.abs(line.width - other.width) < 1 &&
            Math.abs(line.left - other.left) < 1
          );
        })) {
          return prev;
        }
        return merged;
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activePageIndex, currentDua?.id, fontScale, layoutTick, pageSignature, readingBarEnabled]);

  useEffect(() => {
    if (!readingBarEnabled) {
      setActiveVisualLineIndex(0);
      return;
    }

    if (visualLines.length === 0) return;
    const anchor = pendingHighlightAnchorRef.current;
    setActiveVisualLineIndex(anchor === 'last' ? Math.max(visualLines.length - 1, 0) : 0);
    pendingHighlightAnchorRef.current = 'first';
  }, [activePageIndex, readingBarEnabled, visualLines.length]);

  useEffect(() => {
    if (!readingBarEnabled || visualLines.length === 0) return;
    setActiveVisualLineIndex((prev) => Math.min(prev, visualLines.length - 1));
  }, [readingBarEnabled, visualLines.length]);

  const navigatePage = useCallback((dir: 1 | -1, trigger: 'user' | 'auto' = 'user') => {
    if (pages.length === 0) return;

    if (dir > 0) {
      const nextPage = pages[activePageIndex + 1];
      if (nextPage) {
        pendingHighlightAnchorRef.current = 'first';
        setDirection(1);
        jumpToLine(nextPage.start);
        return;
      }

      pendingHighlightAnchorRef.current = 'first';
      setDirection(1);
      if (duaIndex < playlist.length - 1 || (trigger === 'auto' && duaSettings.autoRotate && playlist.length > 1)) {
        goToNextDua(trigger);
        return;
      }
      onExit();
      return;
    }

    const previousPage = pages[activePageIndex - 1];
    if (previousPage) {
      pendingHighlightAnchorRef.current = 'last';
      setDirection(-1);
      jumpToLine(previousPage.start);
      return;
    }

    pendingHighlightAnchorRef.current = 'last';
    setDirection(-1);
    if (duaIndex > 0) {
      goToPreviousDua();
      return;
    }
    (onBack || onExit)();
  }, [activePageIndex, duaIndex, duaSettings.autoRotate, goToNextDua, goToPreviousDua, jumpToLine, onBack, onExit, pages, playlist.length]);

  const navigateReadingLine = useCallback((dir: 1 | -1, trigger: 'user' | 'auto' = 'user') => {
    if (!readingBarEnabled || visualLines.length === 0) {
      navigatePage(dir, trigger);
      return;
    }

    if (dir > 0) {
      if (activeVisualLineIndex < visualLines.length - 1) {
        setActiveVisualLineIndex((prev) => prev + 1);
        return;
      }
      navigatePage(1, trigger);
      return;
    }

    if (activeVisualLineIndex > 0) {
      setActiveVisualLineIndex((prev) => prev - 1);
      return;
    }

    navigatePage(-1, trigger);
  }, [activeVisualLineIndex, navigatePage, readingBarEnabled, visualLines.length]);

  useEffect(() => {
    const previous = previousLineIndexRef.current;
    if (lineIndex !== previous) {
      setDirection(lineIndex > previous ? 1 : -1);
      previousLineIndexRef.current = lineIndex;
    }
  }, [lineIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.code;
      const canNavigate = controlScheme === 'presenter' ? true : (duaSettings.remoteControlMode || previewMode);

      if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space', 'Enter', 'Escape'].includes(key)) {
        e.preventDefault();
      }

      if (key === 'Escape' || key === 'Backspace') {
        onExit();
        return;
      }

      if (!canNavigate) return;
      if (controlScheme === 'presenter') {
        if (key === 'ArrowRight') {
          if (readingBarEnabled && visualLines.length > 0) {
            if (activeVisualLineIndex < visualLines.length - 1) {
              setActiveVisualLineIndex((prev) => prev + 1);
              return;
            }
          }
          const nextPage = pages[activePageIndex + 1];
          if (!nextPage) return;
          pendingHighlightAnchorRef.current = 'first';
          setDirection(1);
          jumpToLine(nextPage.start);
          return;
        }
        if (key === 'ArrowLeft') {
          if (readingBarEnabled && visualLines.length > 0) {
            if (activeVisualLineIndex > 0) {
              setActiveVisualLineIndex((prev) => prev - 1);
              return;
            }
          }
          const previousPage = pages[activePageIndex - 1];
          if (!previousPage) return;
          pendingHighlightAnchorRef.current = 'last';
          setDirection(-1);
          jumpToLine(previousPage.start);
          return;
        }
        if (key === 'PageDown') {
          if (duaIndex >= playlist.length - 1) return;
          pendingHighlightAnchorRef.current = 'first';
          setDirection(1);
          goToNextDua('user');
          return;
        }
        if (key === 'PageUp') {
          if (duaIndex <= 0) return;
          pendingHighlightAnchorRef.current = 'last';
          setDirection(-1);
          goToPreviousDua();
        }
        return;
      }
      if (['ArrowRight', 'ArrowDown', 'PageDown', 'Space', 'Enter'].includes(key)) {
        if (pageNavigationMode) {
          navigatePage(1);
        } else {
          navigateReadingLine(1);
        }
      }

      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) {
        if (pageNavigationMode) {
          navigatePage(-1);
        } else {
          navigateReadingLine(-1);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activePageIndex, activeVisualLineIndex, controlScheme, duaIndex, duaSettings.remoteControlMode, goToNextDua, goToPreviousDua, jumpToLine, navigatePage, navigateReadingLine, onExit, pageNavigationMode, pages, playlist.length, previewMode, readingBarEnabled, visualLines.length]);

  useEffect(() => {
    if (!pageNavigationMode) return;
    if (!currentDua || duaSettings.advanceMode !== 'auto') return;

    const activeDurationSec = currentDua.lineDurationSec ?? duaSettings.displayDurationSec;
    if (activeDurationSec <= 0) return;

    const timer = window.setTimeout(() => {
      navigatePage(1, 'auto');
    }, Math.max(1, activeDurationSec) * 1000);

    return () => window.clearTimeout(timer);
  }, [activePageIndex, currentDua, duaSettings.advanceMode, duaSettings.displayDurationSec, navigatePage, pageNavigationMode]);

  useEffect(() => {
    if (pageNavigationMode || !readingBarEnabled) return;
    if (!currentDua || duaSettings.advanceMode !== 'auto' || visualLines.length === 0) return;

    const activeDurationSec = currentDua.lineDurationSec ?? duaSettings.displayDurationSec;
    if (activeDurationSec <= 0) return;

    const timer = window.setTimeout(() => {
      navigateReadingLine(1, 'auto');
    }, Math.max(1, activeDurationSec) * 1000);

    return () => window.clearTimeout(timer);
  }, [activeVisualLineIndex, currentDua, duaSettings.advanceMode, duaSettings.displayDurationSec, navigateReadingLine, pageNavigationMode, readingBarEnabled, visualLines.length]);

  const showControls = true;
  const hasDuas = playlist.length > 0;
  const title = currentDua?.title || 'أدعية رمضان';
  const selectedBackgroundImage = duaSettings.backgroundImage;
  const selectedBackgroundColor = duaSettings.backgroundColor || '#07111f';
  const pageItems = activePage?.items ?? [];
  const currentPageText = pageItems.map((item) => item.text).join(' ');
  const shouldReduceVisualEffects = useMemo(() => {
    const lowPowerDevice = typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;
    const veryLongCurrentPage = currentPageText.length > 1400;
    const veryLongDua = lines.length > 220;
    const highFontScale = fontScale >= 1.3;
    return lowPowerDevice || veryLongCurrentPage || veryLongDua || highFontScale;
  }, [currentPageText, fontScale, lines.length]);
  const footerLabel = hasDuas
    ? `الدعاء ${duaIndex + 1} من ${playlist.length} • الصفحة ${Math.min(activePageIndex + 1, Math.max(pages.length, 1))} من ${Math.max(pages.length, 1)}`
    : 'أدعية رمضان';
  const viewerStyle = {
    '--ramadan-background-core': selectedBackgroundColor,
    '--ramadan-background-soft': toRgba(selectedBackgroundColor, 0.76),
    '--ramadan-background-strong': toRgba(selectedBackgroundColor, 0.92),
    '--ramadan-background-glow': toRgba(selectedBackgroundColor, 0.34),
    '--ramadan-reading-bar': toRgba(duaSettings.readingBarColor, 0.2),
    '--ramadan-reading-bar-border': toRgba(duaSettings.readingBarColor, 0.6),
    '--ramadan-reading-bar-glow': toRgba(duaSettings.readingBarColor, 0.32),
    '--ramadan-accent': duaSettings.readingBarColor,
    '--ramadan-line-transition-top': `${visualLines[activeVisualLineIndex]?.top ?? 0}px`,
    '--ramadan-line-transition-height': `${Math.max(visualLines[activeVisualLineIndex]?.height ?? 0, 0)}px`,
    '--ramadan-line-transition-width': `${visualLines[activeVisualLineIndex]?.width ?? 0}px`,
    '--ramadan-line-transition-left': `${visualLines[activeVisualLineIndex]?.left ?? 0}px`
  } as React.CSSProperties;

  return (
    <div
      dir="rtl"
      className={`ramadan-viewer ${readingBarEnabled ? 'has-reading-bar' : ''} ${shouldReduceVisualEffects ? 'is-performance' : ''}`}
      style={viewerStyle}
    >
      <div className="ramadan-viewer-corner ramadan-viewer-corner-left"></div>
      <div className="ramadan-viewer-corner ramadan-viewer-corner-right"></div>

      <div className="ramadan-viewer-background">
        {selectedBackgroundImage ? (
          <img src={selectedBackgroundImage} className="ramadan-viewer-background-image" alt="" />
        ) : (
          <div className="ramadan-viewer-background-fallback"></div>
        )}
        <div className="ramadan-viewer-background-aura" aria-hidden="true"></div>
        <div className="ramadan-viewer-background-noise" aria-hidden="true"></div>
        <div className="ramadan-viewer-background-particles" aria-hidden="true">
          <span className="ramadan-viewer-particle ramadan-viewer-particle-1"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-2"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-3"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-4"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-5"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-6"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-7"></span>
          <span className="ramadan-viewer-particle ramadan-viewer-particle-8"></span>
        </div>
        <div className="ramadan-viewer-background-overlay"></div>
        <div className="ramadan-viewer-background-vignette"></div>
      </div>

      {showControls && (
        <button onClick={onExit} className="ramadan-viewer-close" aria-label="إغلاق">
          <X className="ramadan-viewer-close-icon" />
        </button>
      )}

      <div className="ramadan-viewer-content">
        <div className="ramadan-viewer-slide">
          <div className="ramadan-viewer-header">
            <div className="ramadan-viewer-title-shell">
              <h2 className="ramadan-viewer-title">{title}</h2>
            </div>
          </div>

          <div className="ramadan-viewer-copy">
            <div className="ramadan-viewer-copy-ornaments" aria-hidden="true">
              <span className="ramadan-viewer-copy-ornament ramadan-viewer-copy-ornament-top-left"></span>
              <span className="ramadan-viewer-copy-ornament ramadan-viewer-copy-ornament-top-right"></span>
              <span className="ramadan-viewer-copy-ornament ramadan-viewer-copy-ornament-bottom-left"></span>
              <span className="ramadan-viewer-copy-ornament ramadan-viewer-copy-ornament-bottom-right"></span>
              <span className="ramadan-viewer-copy-medallion ramadan-viewer-copy-medallion-top"></span>
              <span className="ramadan-viewer-copy-medallion ramadan-viewer-copy-medallion-bottom"></span>
            </div>
            <div ref={copyBodyRef} className="ramadan-viewer-copy-body">
              <div
                ref={pageFrameRef}
                key={`${currentDua?.id || 'empty'}-${activePageIndex}`}
                className={`ramadan-viewer-page-frame ${direction > 0 ? 'is-next' : 'is-prev'}`}
              >
                {readingBarEnabled && visualLines.length > 0 && (
                  <div className="ramadan-viewer-line-indicator" aria-hidden="true"></div>
                )}
                <p
                  className="ramadan-viewer-text"
                  style={{ fontSize: `calc(clamp(2.2rem, 3.9vw, 5.8rem) * ${fontScale})` }}
                >
                  {currentPageText ? (
                    <span ref={textFlowRef} className="ramadan-viewer-text-flow">
                      {currentPageText}
                    </span>
                  ) : (
                    <span className="ramadan-viewer-text-line is-empty">لا توجد أدعية مفعلة حاليًا من لوحة الإعدادات</span>
                  )}
                </p>
              </div>
            </div>

            <div className="ramadan-viewer-reference">{footerLabel}</div>
          </div>
        </div>
      </div>

      <div className="ramadan-viewer-progress-shell" aria-hidden="true">
        <div className="ramadan-viewer-progress">
          {Array.from({ length: Math.max(pages.length, 1) }).map((_, index) => (
            <div
              key={index}
              className={`ramadan-viewer-progress-dot ${index === activePageIndex ? 'is-active' : ''}`}
            />
          ))}
        </div>
      </div>

      <div ref={measureRef} className="ramadan-viewer-measure" aria-hidden="true">
        <p
          ref={measureTextRef}
          className="ramadan-viewer-text ramadan-viewer-text--measure"
          style={{ fontSize: `calc(clamp(2.2rem, 3.9vw, 5.8rem) * ${fontScale})` }}
        ></p>
      </div>
    </div>
  );
};

export default RamadanDuasView;
