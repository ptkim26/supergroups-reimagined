import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';

// ── Design tokens (duplicated from index.tsx per file convention) ────────────

const C = {
  surface: '#ffffff',
  surfaceAlt: '#f6f5f4',
  border: 'rgba(0,0,0,0.1)',
  borderStrong: 'rgba(0,0,0,0.2)',
  text: 'rgba(0,0,0,0.95)',
  textSecondary: '#615d59',
  textMuted: '#a39e98',
  accent: '#0075de',
  accentHover: '#005bab',
  accentLight: '#f2f9ff',
};

const FONT = 'Inter, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif';

// ── Types ────────────────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'accent' | 'amber' | 'red';

export interface BottomPillTabSpec {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: { text: string; tone?: BadgeTone };
  disabled?: boolean;
  hidden?: boolean;
}

interface BottomPillNavProps {
  tabs: BottomPillTabSpec[];
  activeId: string;
  onChange: (id: string) => void;
  /** Render inline in flow (e.g. inside a card footer). Default is fixed-viewport. */
  scoped?: boolean;
  /** Compact (for narrow drawers). Uses sticky positioning. */
  compact?: boolean;
  bottomOffset?: number;
  keyboardOpen?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isTouch;
}

// ── Rolling number (odometer-style digit transitions) ───────────────────────
//
// Renders each character of a numeric string as a vertical strip of 0-9. The strip
// is translated to show the current digit; when the digit changes, CSS transitions
// the translateY to the new digit smoothly. Non-digit characters (commas, +, −, -)
// pass through statically. Direction of scroll matches the direction of change:
// increases roll up, decreases roll down — the eye sees the number climb or fall.

const DIGIT_H = 13; // must match the badge lineHeight so each digit aligns

function DigitColumn({ digit, direction }: { digit: string; direction: 1 | -1 }) {
  // Mount-time digit: start from "no translate change needed".
  // When digit updates, re-translate. We key the inner stack to the current digit
  // to force transition recomputation when the column "resets" (e.g. 9 -> 0 rollover)
  // but in practice a simple translate works perfectly for all 0-9 transitions.
  const target = Number(digit);
  // Two stacks rendered vertically: 0..9 when scrolling up, 9..0 when scrolling down.
  // Using a single 0..9 stack with both directions works too — translate is signed.
  const translate = direction === 1 ? -target * DIGIT_H : -(9 - target) * DIGIT_H;
  const sequence = direction === 1
    ? ['0','1','2','3','4','5','6','7','8','9']
    : ['9','8','7','6','5','4','3','2','1','0'];

  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        height: DIGIT_H,
        lineHeight: `${DIGIT_H}px`,
        overflow: 'hidden',
        verticalAlign: 'top',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          transform: `translateY(${translate}px)`,
          transition: `transform 520ms cubic-bezier(0.34, 1.2, 0.34, 1)`,
          willChange: 'transform',
        }}
      >
        {sequence.map(d => (
          <span key={d} style={{ height: DIGIT_H, lineHeight: `${DIGIT_H}px`, display: 'block' }}>{d}</span>
        ))}
      </span>
    </span>
  );
}

function RollingNumber({ value }: { value: string }) {
  const prevRef = useRef<string>(value);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Determine direction by numeric comparison when possible.
  useEffect(() => {
    const prev = prevRef.current;
    if (prev === value) return;
    const a = parseFloat(prev.replace(/[^\d.-]/g, '')) || 0;
    const b = parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
    setDirection(b >= a ? 1 : -1);
    prevRef.current = value;
  }, [value]);

  // Per-character rendering: digits get a column, everything else renders plainly.
  const chars = useMemo(() => value.split(''), [value]);

  // Announce just the final number to assistive tech (the column reels are aria-hidden).
  return (
    <span role="text" aria-label={value} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {chars.map((ch, i) => {
        if (/\d/.test(ch)) {
          // Key by position — if the length changes (99 → 100), React remounts trailing columns
          return <DigitColumn key={`d-${i}`} digit={ch} direction={direction} />;
        }
        return (
          <span key={`s-${i}-${ch}`} style={{ display: 'inline-block', height: DIGIT_H, lineHeight: `${DIGIT_H}px` }}>{ch}</span>
        );
      })}
    </span>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Badge({ text, tone = 'neutral', active }: { text: string; tone?: BadgeTone; active: boolean }) {
  const palette = (() => {
    if (tone === 'accent') return { bg: active ? 'rgba(0,117,222,0.18)' : C.accentLight, color: C.accent };
    if (tone === 'amber') return { bg: 'rgba(221,91,0,0.14)', color: '#b84a00' };
    if (tone === 'red') return { bg: 'rgba(211,45,45,0.14)', color: '#b32424' };
    return { bg: active ? 'rgba(0,0,0,0.09)' : 'rgba(0,0,0,0.07)', color: C.textSecondary };
  })();
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 0.15,
      padding: '1px 5px', borderRadius: 9999,
      background: palette.bg, color: palette.color,
      lineHeight: `${DIGIT_H}px`,
      minWidth: 14, textAlign: 'center',
      transition: `background ${TX}, color ${TX}`,
    }}>
      <RollingNumber value={text} />
    </span>
  );
}

// ── Tab pill (one segment) ───────────────────────────────────────────────────

interface TabPillProps {
  spec: BottomPillTabSpec;
  isActive: boolean;
  isHovered: boolean;
  isFocused: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onFocus: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}

// Unified motion curve — every animated property shares this exact timing
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DUR = 260;
const TX = `${DUR}ms ${EASE}`;

function TabPill({ spec, isActive, isHovered, isFocused, onClick, onMouseEnter, onFocus, onPointerDown, buttonRef }: TabPillProps) {
  // Only the active tab shows its label. Grid layout with an animated label column keeps the
  // motion smooth: every geometry change (tab padding, label width, traveler left/width)
  // shares the same timing function and duration.
  return (
    <button
      ref={buttonRef}
      id={`bn-tab-${spec.id}`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`bn-panel-${spec.id}`}
      aria-disabled={spec.disabled || undefined}
      tabIndex={isActive ? 0 : -1}
      disabled={spec.disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
      style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px',
        border: 'none',
        background: 'transparent',
        color: isActive ? C.accent : C.textSecondary,
        opacity: spec.disabled ? 0.4 : 1,
        cursor: spec.disabled ? 'default' : 'pointer',
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: isActive ? 600 : 500,
        borderRadius: 9999,
        whiteSpace: 'nowrap',
        transition: `color ${TX}`,
        outline: 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, flexShrink: 0,
          opacity: isActive ? 1 : isHovered || isFocused ? 0.92 : 0.65,
          transition: `opacity ${TX}`,
        }}
      >
        {spec.icon}
      </span>
      <span
        style={{
          display: 'inline-grid',
          gridTemplateColumns: isActive ? '1fr' : '0fr',
          marginLeft: isActive ? 0 : -6,
          overflow: 'hidden',
          transition: `grid-template-columns ${TX}, margin-left ${TX}`,
        }}
      >
        <span style={{
          minWidth: 0,
          opacity: isActive ? 1 : 0,
          transition: `opacity ${TX}`,
        }}>
          {spec.label}
        </span>
      </span>
      {spec.badge && (
        <span style={{
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <Badge text={spec.badge.text} tone={spec.badge.tone} active={isActive} />
        </span>
      )}
    </button>
  );
}

// ── BottomPillNav (main) ─────────────────────────────────────────────────────

export default function BottomPillNav({
  tabs,
  activeId,
  onChange,
  scoped = false,
  compact = false,
  bottomOffset,
  keyboardOpen = false,
}: BottomPillNavProps) {
  const visible = tabs.filter(t => !t.hidden);
  const activeIndex = Math.max(0, visible.findIndex(t => t.id === activeId));

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const [indicatorRect, setIndicatorRect] = useState<{ left: number; width: number; ready: boolean }>({ left: 0, width: 0, ready: false });

  const reducedMotion = usePrefersReducedMotion();
  const isTouch = useIsTouch();
  const rafRef = useRef<number | null>(null);

  const indicatorTargetIndex = (!isTouch && hoveredIndex !== null)
    ? hoveredIndex
    : (focusedIndex !== null ? focusedIndex : activeIndex);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const target = buttonRefs.current[indicatorTargetIndex];
    if (!container || !target) return;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    setIndicatorRect({
      left: tRect.left - cRect.left,
      width: tRect.width,
      ready: true,
    });
  }, [indicatorTargetIndex]);

  useLayoutEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [measure, visible.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Only observe container size — tab resizes during transition cause the indicator
    // to chase a moving target. The CSS transition interpolates the indicator smoothly
    // from its current state to the new target; we re-measure only on container change
    // (e.g. viewport resize, font load) and on transitionend for the final correction.
    const ro = new ResizeObserver(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    ro.observe(container);
    // Correct the indicator once tabs finish their own transition — covers the case
    // where the measured target rect at commit time differs from its final rect.
    const onTransitionEnd = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.getAttribute?.('role') !== 'tab') return;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    container.addEventListener('transitionend', onTransitionEnd);
    return () => {
      ro.disconnect();
      container.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [measure, visible.length]);

  useEffect(() => {
    const handleWindowUp = () => setPressing(false);
    window.addEventListener('pointerup', handleWindowUp);
    window.addEventListener('pointercancel', handleWindowUp);
    return () => {
      window.removeEventListener('pointerup', handleWindowUp);
      window.removeEventListener('pointercancel', handleWindowUp);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = focusedIndex ?? activeIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      let next = current;
      for (let step = 1; step <= visible.length; step++) {
        const candidate = (current + step) % visible.length;
        if (!visible[candidate].disabled) { next = candidate; break; }
      }
      buttonRefs.current[next]?.focus();
      setFocusedIndex(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      let next = current;
      for (let step = 1; step <= visible.length; step++) {
        const candidate = (current - step + visible.length) % visible.length;
        if (!visible[candidate].disabled) { next = candidate; break; }
      }
      buttonRefs.current[next]?.focus();
      setFocusedIndex(next);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const next = visible.findIndex(t => !t.disabled);
      if (next >= 0) { buttonRefs.current[next]?.focus(); setFocusedIndex(next); }
    } else if (e.key === 'End') {
      e.preventDefault();
      for (let i = visible.length - 1; i >= 0; i--) {
        if (!visible[i].disabled) { buttonRefs.current[i]?.focus(); setFocusedIndex(i); break; }
      }
    }
  };

  const handleSelect = (tab: BottomPillTabSpec) => {
    if (tab.disabled) return;
    onChange(tab.id);
  };

  const indicatorBg = pressing
    ? 'rgba(0,117,222,0.18)'
    : (hoveredIndex !== null && !isTouch)
      ? 'rgba(0,0,0,0.06)'
      : C.accentLight;

  if (keyboardOpen) return null;

  const defaultBottom = compact ? 12 : 88;
  const finalBottom = bottomOffset ?? defaultBottom;

  const positioning: React.CSSProperties = scoped
    ? { position: 'relative', zIndex: 2 }
    : compact
      ? {
        position: 'sticky',
        bottom: finalBottom,
        marginLeft: 'auto', marginRight: 'auto',
        zIndex: 200,
      }
      : {
        position: 'fixed',
        bottom: `calc(${finalBottom}px + env(safe-area-inset-bottom, 0px))`,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
      };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Group views"
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHoveredIndex(null)}
      style={{
        ...positioning,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 4,
        borderRadius: 9999,
        background: scoped
          ? 'linear-gradient(180deg, rgba(0,0,0,0.025) 0%, rgba(0,0,0,0.045) 100%)'
          : 'rgba(255,255,255,0.92)',
        backdropFilter: scoped ? undefined : 'blur(14px)',
        WebkitBackdropFilter: scoped ? undefined : 'blur(14px)',
        border: scoped
          ? '1px solid rgba(0,0,0,0.06)'
          : `1px solid ${C.border}`,
        boxShadow: scoped
          ? 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.015), 0 1px 2px rgba(0,0,0,0.04), 0 4px 10px rgba(0,0,0,0.035)'
          : '0 10px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)',
        fontFamily: FONT,
      }}
    >
      {indicatorRect.ready && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: indicatorRect.left,
            width: indicatorRect.width,
            background: indicatorBg,
            borderRadius: 9999,
            zIndex: 1,
            transition: reducedMotion
              ? 'none'
              : `left ${TX}, width ${TX}, background ${TX}`,
            pointerEvents: 'none',
          }}
        />
      )}

      {visible.map((tab, i) => (
        <TabPill
          key={tab.id}
          spec={tab}
          isActive={i === activeIndex}
          isHovered={!isTouch && hoveredIndex === i}
          isFocused={focusedIndex === i}
          onClick={() => handleSelect(tab)}
          onMouseEnter={() => { if (!isTouch) setHoveredIndex(i); }}
          onFocus={() => setFocusedIndex(i)}
          onPointerDown={() => setPressing(true)}
          buttonRef={el => { buttonRefs.current[i] = el; }}
        />
      ))}
    </div>
  );
}
