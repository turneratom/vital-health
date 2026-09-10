import React, { useState, useRef, useCallback } from 'react';
import { BiologicalInsights } from '@/components/Dashboard/BiologicalInsights';

/* ══════════════════════════════════════════════════════════════ */
/*  BIO CAROUSEL — Biological Insights + Discover Vive           */
/*  Swipeable 2-slide carousel with dot indicators               */
/* ══════════════════════════════════════════════════════════════ */

/* ── Discover Vive Checklist Items ── */
const DISCOVER_ITEMS = [
  { id: 'bloodwork', icon: '🩸', label: 'Sync Blood Work', description: 'Connect your latest lab results for deep biomarker analysis', done: false },
  { id: 'dna', icon: '🧬', label: 'Setup DNA Profile', description: 'Upload genetic data to unlock personalized insights', done: false },
  { id: 'wearable', icon: '⌚', label: 'Connect Wearable', description: 'Link your fitness tracker for real-time vitals', done: true },
  { id: 'peer', icon: '👥', label: 'Invite a Peer', description: 'Build your accountability network', done: false },
  { id: 'journal', icon: '📓', label: 'Log First Journal Entry', description: 'Start tracking your daily wellness narrative', done: false },
  { id: 'goal', icon: '🎯', label: 'Set a Health Goal', description: 'Define your first measurable target', done: true },
];

/* ── Discover Vive Checklist (Slide 2) ── */
function DiscoverChecklist() {
  const completed = DISCOVER_ITEMS.filter(i => i.done).length;
  const total = DISCOVER_ITEMS.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col gap-3 py-1">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <span className="typo-label text-[9px] tracking-wider" style={{ color: 'rgba(196,164,108,0.5)' }}>
          {completed}/{total} COMPLETE
        </span>
        <span className="typo-data text-[11px] tabular-nums" style={{ color: 'rgba(196,164,108,0.7)' }}>
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(196,164,108,0.08)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, rgba(196,164,108,0.6), rgba(196,164,108,0.9))',
            boxShadow: '0 0 8px rgba(196,164,108,0.3)',
          }}
        />
      </div>

      {/* Checklist items */}
      <div className="flex flex-col gap-1.5">
        {DISCOVER_ITEMS.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200"
            style={{
              background: item.done ? 'rgba(196,164,108,0.04)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${item.done ? 'rgba(196,164,108,0.1)' : 'rgba(255,255,255,0.04)'}`,
              opacity: item.done ? 0.55 : 1,
            }}
          >
            {/* Checkbox */}
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{
                background: item.done ? 'rgba(196,164,108,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${item.done ? 'rgba(196,164,108,0.4)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {item.done && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="rgba(196,164,108,0.9)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>

            {/* Icon */}
            <span className="text-sm flex-shrink-0">{item.icon}</span>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className="typo-label text-[11px] tracking-wide"
                style={{
                  color: item.done ? 'rgba(196,164,108,0.5)' : 'rgba(224,224,224,0.85)',
                  textDecoration: item.done ? 'line-through' : 'none',
                }}
              >
                {item.label}
              </p>
              <p className="typo-sublabel text-[9px] mt-0.5" style={{ color: 'rgba(196,164,108,0.3)' }}>
                {item.description}
              </p>
            </div>

            {/* Arrow for incomplete */}
            {!item.done && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                <path d="M9 18l6-6-6-6" stroke="rgba(196,164,108,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Carousel ── */
export function BioCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const isDragging = useRef(false);
  const SLIDE_COUNT = 2;
  const SWIPE_THRESHOLD = 50;

  const slideLabels = ['Biological Insights', 'Discover Vive'];
  const slideIcons = ['🧬', '🚀'];

  const goToSlide = useCallback((idx: number) => {
    setActiveSlide(Math.max(0, Math.min(SLIDE_COUNT - 1, idx)));
  }, []);

  /* Touch handlers for swipe */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isDragging.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (touchDeltaX.current < -SWIPE_THRESHOLD) {
      goToSlide(activeSlide + 1);
    } else if (touchDeltaX.current > SWIPE_THRESHOLD) {
      goToSlide(activeSlide - 1);
    }
    touchDeltaX.current = 0;
  }, [activeSlide, goToSlide]);

  /* Mouse drag for desktop */
  const mouseStartX = useRef(0);
  const mouseDragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartX.current = e.clientX;
    mouseDragging.current = true;
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDragging.current) return;
    touchDeltaX.current = e.clientX - mouseStartX.current;
  }, []);

  const onMouseUp = useCallback(() => {
    if (!mouseDragging.current) return;
    mouseDragging.current = false;
    if (touchDeltaX.current < -SWIPE_THRESHOLD) {
      goToSlide(activeSlide + 1);
    } else if (touchDeltaX.current > SWIPE_THRESHOLD) {
      goToSlide(activeSlide - 1);
    }
    touchDeltaX.current = 0;
  }, [activeSlide, goToSlide]);

  return (
    <div className="flex flex-col gap-3">
      {/* ── Slide header with tab-style labels ── */}
      <div className="flex items-center gap-1">
        {slideLabels.map((label, i) => (
          <button
            key={label}
            onClick={() => goToSlide(i)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-300"
            style={{
              background: activeSlide === i ? 'rgba(196,164,108,0.08)' : 'transparent',
              border: `1px solid ${activeSlide === i ? 'rgba(196,164,108,0.15)' : 'transparent'}`,
            }}
          >
            <span className="text-[10px]">{slideIcons[i]}</span>
            <span
              className="typo-label text-[9px] tracking-wider transition-colors duration-300"
              style={{ color: activeSlide === i ? 'rgba(196,164,108,0.8)' : 'rgba(196,164,108,0.3)' }}
            >
              {label.toUpperCase()}
            </span>
          </button>
        ))}
      </div>

      {/* ── Carousel viewport ── */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(196,164,108,0.06)',
          touchAction: 'pan-y',
          cursor: 'grab',
          userSelect: 'none',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(-${activeSlide * 100}%)`,
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            transitionDuration: '400ms',
            transitionProperty: 'transform',
          }}
        >
          {/* Slide 1: Biological Insights (with simulated fallback) */}
          <div className="w-full flex-shrink-0 px-4 py-3" style={{ minWidth: '100%' }}>
            <BiologicalInsights
              currentSteps={0}
              currentSleepHours={0}
              stepsHistory={null}
              sleepHistory={null}
              ghostMode={false}
            />
          </div>

          {/* Slide 2: Discover Vive */}
          <div className="w-full flex-shrink-0 px-4 py-3" style={{ minWidth: '100%' }}>
            <DiscoverChecklist />
          </div>
        </div>
      </div>

      {/* ── Dot indicators ── */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: activeSlide === i ? 20 : 6,
              height: 6,
              background: activeSlide === i
                ? 'rgba(196,164,108,0.7)'
                : 'rgba(196,164,108,0.15)',
              boxShadow: activeSlide === i ? '0 0 8px rgba(196,164,108,0.3)' : 'none',
            }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

export default BioCarousel;
