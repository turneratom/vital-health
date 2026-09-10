import { useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Constants ── */
const CYAN = '#00F2FF';
const PURPLE = '#BF5AF2';
const CYAN_DIM = 'rgba(0,242,255,';

interface DatePill {
  date: Date;
  label: string;
  dayName: string;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
  dateKey: string;
}

function generateDateWindow(): DatePill[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pills: DatePill[] = [];

  // Show 3 past days + today + 7 future days for planning
  for (let offset = -3; offset <= 7; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const isToday = offset === 0;
    const isFuture = offset > 0;
    const isPast = offset < 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = isToday ? 'Today' : offset === 1 ? 'Tmrw' : dayNames[d.getDay()];
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    pills.push({ date: d, label, dayName, isToday, isFuture, isPast, dateKey });
  }

  return pills;
}

interface DateScrollerProps {
  selectedDate: string;
  onDateSelect: (dateKey: string) => void;
  ghostMode: boolean;
}

export function DateScroller({ selectedDate, onDateSelect, ghostMode }: DateScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLButtonElement>(null);
  const pills = generateDateWindow();
  const todayKey = getTodayDateKey();
  const isOnToday = selectedDate === todayKey;

  const handleSelect = useCallback((dateKey: string) => {
    onDateSelect(dateKey);
    if (navigator.vibrate) navigator.vibrate(8);
  }, [onDateSelect]);

  const snapToToday = useCallback(() => {
    onDateSelect(todayKey);
    if (navigator.vibrate) navigator.vibrate([12, 40, 12]);
    requestAnimationFrame(() => {
      todayRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    });
  }, [onDateSelect, todayKey]);

  // Auto-center today pill on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
        inline: 'center',
      });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex items-center">
      {/* Today snap-back button */}
      <AnimatePresence>
        {!isOnToday && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.5, x: -8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={snapToToday}
            className="absolute left-1.5 z-20 flex items-center gap-1 rounded-full px-2.5 py-1.5 backdrop-blur-xl cursor-pointer"
            style={{
              background: ghostMode
                ? 'rgba(160,160,160,0.12)'
                : `linear-gradient(135deg, ${CYAN_DIM}0.15), rgba(191,90,242,0.08))`,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.2)' : `${CYAN_DIM}0.3)`}`,
              boxShadow: ghostMode
                ? 'none'
                : `0 0 12px ${CYAN_DIM}0.15), 0 2px 8px rgba(0,0,0,0.3)`,
            }}
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            title="Snap back to today"
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.5)' : CYAN,
                boxShadow: ghostMode ? 'none' : `0 0 6px ${CYAN}`,
              }}
              animate={ghostMode ? {} : {
                boxShadow: [
                  `0 0 4px ${CYAN_DIM}0.4)`,
                  `0 0 10px ${CYAN_DIM}0.7)`,
                  `0 0 4px ${CYAN_DIM}0.4)`,
                ],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span
              className="text-[9px] font-mono font-bold uppercase tracking-[0.1em] leading-none"
              style={{
                color: ghostMode ? 'rgba(200,200,200,0.7)' : CYAN,
                textShadow: ghostMode ? 'none' : `0 0 6px ${CYAN_DIM}0.3)`,
              }}
            >
              Today
            </span>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="flex-shrink-0">
              <path
                d="M4 1L4 7M4 7L1.5 4.5M4 7L6.5 4.5"
                stroke={ghostMode ? 'rgba(160,160,160,0.5)' : CYAN}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="rotate(-90 4 4)"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 flex-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingLeft: !isOnToday ? 72 : 20,
          paddingRight: 20,
          transition: 'padding-left 0.3s ease',
        }}
      >
        {pills.map((pill) => {
          const isSelected = pill.dateKey === selectedDate;
          const isToday = pill.isToday;

          let pillBg: string;
          let pillBorder: string;
          let pillShadow: string;
          let dayColor: string;
          let dateColor: string;

          if (isSelected && isToday) {
            pillBg = ghostMode
              ? 'rgba(160,160,160,0.12)'
              : `linear-gradient(135deg, ${CYAN_DIM}0.12), rgba(191,90,242,0.08))`;
            pillBorder = ghostMode ? 'rgba(160,160,160,0.25)' : `${CYAN_DIM}0.4)`;
            pillShadow = ghostMode ? 'none' : `0 0 16px ${CYAN_DIM}0.2), 0 0 32px ${CYAN_DIM}0.08)`;
            dayColor = ghostMode ? 'rgba(200,200,200,0.8)' : CYAN;
            dateColor = ghostMode ? 'rgba(220,220,220,0.9)' : 'rgba(255,255,255,0.95)';
          } else if (isSelected && pill.isFuture) {
            pillBg = ghostMode
              ? 'rgba(160,160,160,0.1)'
              : `linear-gradient(135deg, rgba(191,90,242,0.12), rgba(107,138,255,0.06))`;
            pillBorder = ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(191,90,242,0.35)';
            pillShadow = ghostMode ? 'none' : `0 0 14px rgba(191,90,242,0.15)`;
            dayColor = ghostMode ? 'rgba(200,200,200,0.7)' : PURPLE;
            dateColor = ghostMode ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.9)';
          } else if (isSelected && pill.isPast) {
            pillBg = ghostMode
              ? 'rgba(160,160,160,0.1)'
              : 'rgba(255,255,255,0.06)';
            pillBorder = ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(255,255,255,0.15)';
            pillShadow = 'none';
            dayColor = ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.7)';
            dateColor = ghostMode ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.85)';
          } else if (isToday && !isSelected) {
            pillBg = ghostMode ? 'rgba(160,160,160,0.04)' : `${CYAN_DIM}0.04)`;
            pillBorder = ghostMode ? 'rgba(160,160,160,0.1)' : `${CYAN_DIM}0.15)`;
            pillShadow = 'none';
            dayColor = ghostMode ? 'rgba(160,160,160,0.5)' : `${CYAN_DIM}0.6)`;
            dateColor = ghostMode ? 'rgba(180,180,180,0.6)' : 'rgba(255,255,255,0.55)';
          } else {
            pillBg = ghostMode ? 'rgba(160,160,160,0.02)' : 'rgba(255,255,255,0.02)';
            pillBorder = ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.05)';
            pillShadow = 'none';
            dayColor = pill.isFuture
              ? (ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(191,90,242,0.4)')
              : (ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)');
            dateColor = pill.isFuture
              ? (ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(191,90,242,0.5)')
              : (ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)');
          }

          return (
            <motion.button
              key={pill.dateKey}
              ref={pill.isToday ? todayRef : undefined}
              onClick={() => handleSelect(pill.dateKey)}
              whileTap={{ scale: 0.92 }}
              className="flex flex-col items-center gap-0.5 rounded-2xl px-3.5 py-2.5 flex-shrink-0 relative transition-all duration-200"
              style={{
                background: pillBg,
                border: `1px solid ${pillBorder}`,
                boxShadow: pillShadow,
                minWidth: 52,
              }}
            >
              {/* Today glow ring */}
              {isToday && isSelected && !ghostMode && (
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ border: `1px solid ${CYAN_DIM}0.25)` }}
                  animate={{
                    boxShadow: [
                      `0 0 8px ${CYAN_DIM}0.15), inset 0 0 8px ${CYAN_DIM}0.05)`,
                      `0 0 16px ${CYAN_DIM}0.25), inset 0 0 12px ${CYAN_DIM}0.08)`,
                      `0 0 8px ${CYAN_DIM}0.15), inset 0 0 8px ${CYAN_DIM}0.05)`,
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              {/* Future date planning indicator */}
              {pill.isFuture && isSelected && !ghostMode && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                  style={{
                    background: PURPLE,
                    boxShadow: `0 0 6px rgba(191,90,242,0.5)`,
                  }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}

              {/* Day name */}
              <span
                className="text-[9px] font-mono font-bold uppercase tracking-[0.12em] leading-none"
                style={{ color: dayColor }}
              >
                {pill.dayName}
              </span>

              {/* Date number */}
              <span
                className="text-[15px] font-bold font-mono tabular-nums leading-none mt-0.5"
                style={{
                  color: dateColor,
                  textShadow: isSelected && isToday && !ghostMode ? `0 0 8px ${CYAN_DIM}0.3)` : 'none',
                }}
              >
                {pill.date.getDate()}
              </span>

              {/* Today dot indicator */}
              {isToday && (
                <div className="mt-0.5 relative">
                  <div
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: ghostMode ? 'rgba(160,160,160,0.4)' : CYAN,
                      boxShadow: isSelected && !ghostMode ? `0 0 4px ${CYAN}` : 'none',
                    }}
                  />
                </div>
              )}

              {/* Future arrow indicator */}
              {pill.isFuture && !isToday && (
                <div className="mt-0.5">
                  <span className="text-[6px]" style={{ color: dayColor, opacity: 0.6 }}>{'\u25B8'}</span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Edge fade indicators */}
      <div
        className="absolute top-0 bottom-0 w-5 pointer-events-none z-10 transition-all duration-300"
        style={{
          left: !isOnToday ? 68 : 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.8), transparent)',
        }}
      />
      <div
        className="absolute top-0 right-0 bottom-0 w-5 pointer-events-none z-10"
        style={{
          background: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)',
        }}
      />
    </div>
  );
}

/* ── Helper: get today's dateKey ── */
export function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Helper: check if dateKey is today ── */
export function isDateToday(dateKey: string): boolean {
  return dateKey === getTodayDateKey();
}

/* ── Helper: check if dateKey is in the future ── */
export function isDateFuture(dateKey: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dateKey.split('-').map(Number);
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);
  return target.getTime() > today.getTime();
}

/* ── Helper: check if dateKey is in the past ── */
export function isDatePast(dateKey: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dateKey.split('-').map(Number);
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

/* ── Helper: format dateKey for display ── */
export function formatDateLabel(dateKey: string): string {
  if (isDateToday(dateKey)) return 'Today';
  const parts = dateKey.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
