import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { motion, AnimatePresence } from 'framer-motion';
import AIStatHeader from '../Journal/AIStatHeader';
import { useAIFoodParser, useAIExerciseParser } from '../../lib/useAI';
import type { ParsedFood, ParsedExercise } from '../../lib/useAI';
import { getTwinSessionId } from '@/lib/twinSession'


/* ═══════════════════════════════════════════════════════ */
/* ── VIVE 4.0 — Daily Ledger (AI-Powered, Frictionless) ── */
/* ═══════════════════════════════════════════════════════ */

const CYAN = '#00F0FF';
const CYAN_DIM = 'rgba(0,240,255,';
const GREEN = '#30D158';
const ORANGE = '#FF9F0A';
const RED = '#FF453A';
const PURPLE = '#BF5AF2';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif';

/* ═══════════════════════════════════════════════════════ */
/* ── DECOUPLED SUB-COMPONENTS (defined outside main)   ── */
/* ═══════════════════════════════════════════════════════ */

/* ── Toast Notification ── */
function Toast({ message, visible, variant = 'success' }: { message: string; visible: boolean; variant?: 'success' | 'syncing' | 'error' }) {
  const icons: Record<string, string> = { success: '\u2601\uFE0F', syncing: '\uD83D\uDD04', error: '\u26A0\uFE0F' };
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-2xl flex items-center gap-2.5"
          style={{
            background: 'rgba(20,22,28,0.95)',
            border: `1px solid ${variant === 'error' ? 'rgba(255,69,58,0.2)' : variant === 'syncing' ? 'rgba(255,159,10,0.2)' : `${CYAN_DIM}0.2)`}`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${variant === 'error' ? 'rgba(255,69,58,0.08)' : `${CYAN_DIM}0.08)`}`,
            backdropFilter: 'blur(20px)',
            fontFamily: FONT_STACK,
          }}
        >
          <span className={`text-[14px] ${variant === 'syncing' ? 'animate-spin' : ''}`}>{icons[variant]}</span>
          <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Date Scroller (5 past + Today + Tomorrow) ── */
function DateScroller({ selectedDate, onSelect }: { selectedDate: string; onSelect: (dateKey: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dates = useMemo(() => {
    const result: { key: string; label: string; dayName: string; isToday: boolean; isTomorrow: boolean }[] = [];
    const now = new Date();
    for (let i = -5; i <= 1; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const isToday = i === 0;
      const isTomorrow = i === 1;
      result.push({
        key,
        label: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : String(d.getDate()),
        dayName: isToday ? 'Today' : isTomorrow ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday, isTomorrow,
      });
    }
    return result;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const todayEl = scrollRef.current.querySelector('[data-today="true"]');
      if (todayEl) todayEl.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }
  }, []);

  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
      {dates.map((d) => {
        const isActive = d.key === selectedDate;
        return (
          <button key={d.key} data-today={d.isToday ? 'true' : undefined} onClick={() => onSelect(d.key)}
            className="flex flex-col items-center gap-1 px-3.5 py-2.5 rounded-2xl flex-shrink-0 transition-all duration-200 active:scale-95"
            style={{
              background: isActive ? `${CYAN_DIM}0.12)` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? `${CYAN_DIM}0.25)` : 'rgba(255,255,255,0.06)'}`,
              minWidth: 56,
            }}>
            <span className="text-[10px] font-medium" style={{ color: isActive ? CYAN : 'rgba(255,255,255,0.4)' }}>{d.dayName}</span>
            <span className="text-[16px] font-bold" style={{ color: isActive ? 'rgba(255,255,255,0.95)' : d.isTomorrow ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)' }}>
              {d.isToday ? 'Today' : d.isTomorrow ? 'Plan' : d.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Calorie Equation Bar ── */
function CalorieBar({ goal, food, exercise }: { goal: number; food: number; exercise: number }) {
  const remaining = goal - food + exercise;
  const pct = Math.min(100, Math.max(0, (food / goal) * 100));
  const isOver = remaining < 0;
  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Calories Remaining</span>
        <span className="text-[18px] font-bold" style={{ color: isOver ? RED : remaining < 300 ? ORANGE : CYAN }}>
          {Math.abs(remaining).toLocaleString()}
          {isOver && <span className="text-[11px] ml-1 font-normal" style={{ color: RED }}>over</span>}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: isOver ? `linear-gradient(90deg, ${RED}, ${RED}cc)` : `linear-gradient(90deg, ${CYAN}88, ${CYAN})` }} />
      </div>
      <div className="flex items-center justify-between text-center">
        {[
          { val: goal, label: 'Goal', color: 'rgba(255,255,255,0.8)' },
          { val: food, label: 'Food', color: 'rgba(255,255,255,0.8)', sep: '\u2212' },
          { val: exercise, label: 'Exercise', color: GREEN, sep: '+' },
          { val: Math.abs(remaining), label: isOver ? 'Over' : 'Left', color: isOver ? RED : CYAN, sep: '=' },
        ].map((item) => (
          <React.Fragment key={item.label}>
            {item.sep && <span className="text-[14px] font-light px-2" style={{ color: 'rgba(255,255,255,0.2)' }}>{item.sep}</span>}
            <div className="flex-1">
              <span className="text-[15px] font-bold block" style={{ color: item.color }}>{item.val.toLocaleString()}</span>
              <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{item.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ── Today's Log Card — Inline Editable + Delete       ── */
/* ═══════════════════════════════════════════════════════ */

type LogEntryType = 'food' | 'activity' | 'water';

interface TodaysLogEntry {
  id: string;
  type: LogEntryType;
  icon: string;
  name: string;
  calories: number;
  time: string;
  loggedAt: number;
  tag?: string;
  tagColor?: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  duration?: number;
  exerciseType?: string;
}

interface TodaysLogCardProps {
  entry: TodaysLogEntry;
  onUpdateName: (id: string, type: LogEntryType, name: string) => void;
  onUpdateCalories: (id: string, type: LogEntryType, calories: number) => void;
  onDelete: (id: string, type: LogEntryType) => void;
}

function TodaysLogCard({ entry, onUpdateName, onUpdateCalories, onDelete }: TodaysLogCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingCal, setEditingCal] = useState(false);
  const [nameVal, setNameVal] = useState(entry.name);
  const [calVal, setCalVal] = useState(String(entry.calories));
  const [hovered, setHovered] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const calRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setNameVal(entry.name); }, [entry.name]);
  useEffect(() => { setCalVal(String(entry.calories)); }, [entry.calories]);
  useEffect(() => { if (editingName && nameRef.current) nameRef.current.focus(); }, [editingName]);
  useEffect(() => { if (editingCal && calRef.current) calRef.current.focus(); }, [editingCal]);

  const commitName = useCallback(() => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== entry.name) {
      onUpdateName(entry.id, entry.type, trimmed);
    } else {
      setNameVal(entry.name);
    }
    setEditingName(false);
  }, [nameVal, entry.id, entry.type, entry.name, onUpdateName]);

  const commitCal = useCallback(() => {
    const num = parseInt(calVal, 10);
    if (!isNaN(num) && num >= 0 && num !== entry.calories) {
      onUpdateCalories(entry.id, entry.type, num);
    } else {
      setCalVal(String(entry.calories));
    }
    setEditingCal(false);
  }, [calVal, entry.id, entry.type, entry.calories, onUpdateCalories]);

  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowDelete(true), 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const isWater = entry.type === 'water';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex items-center gap-3 py-3.5 px-4 rounded-xl transition-colors duration-150"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowDelete(false); }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <span className="text-[16px] flex-shrink-0">{entry.icon}</span>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {editingName ? (
          <input
            ref={nameRef}
            type="text"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameVal(entry.name); setEditingName(false); } }}
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-medium py-0.5 px-1 -ml-1 rounded-md"
            style={{ color: 'rgba(255,255,255,0.9)', caretColor: CYAN, border: `1px solid ${CYAN_DIM}0.25)`, background: `${CYAN_DIM}0.04)` }}
          />
        ) : (
          <button
            onClick={() => { if (!isWater) setEditingName(true); }}
            className="text-[14px] font-medium truncate text-left"
            style={{ color: 'rgba(255,255,255,0.88)', cursor: isWater ? 'default' : 'text' }}
          >
            {entry.name}
          </button>
        )}

        {entry.tag && (
          <span
            className="text-[9px] font-semibold px-1.5 py-[2px] rounded-full flex-shrink-0 whitespace-nowrap"
            style={{ background: `${entry.tagColor || CYAN}12`, color: `${entry.tagColor || CYAN}cc`, border: `1px solid ${entry.tagColor || CYAN}18` }}
          >
            {entry.tag}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {editingCal ? (
          <div className="flex items-center gap-1">
            <input
              ref={calRef}
              type="number"
              inputMode="numeric"
              value={calVal}
              onChange={(e) => setCalVal(e.target.value)}
              onBlur={commitCal}
              onKeyDown={(e) => { if (e.key === 'Enter') commitCal(); if (e.key === 'Escape') { setCalVal(String(entry.calories)); setEditingCal(false); } }}
              className="w-14 text-right bg-transparent outline-none text-[14px] font-bold py-0.5 px-1 rounded-md"
              style={{ color: 'rgba(255,255,255,0.9)', caretColor: CYAN, border: `1px solid ${CYAN_DIM}0.25)`, background: `${CYAN_DIM}0.04)` }}
            />
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>cal</span>
          </div>
        ) : (
          <button
            onClick={() => { if (!isWater) setEditingCal(true); }}
            className="text-[14px] font-bold tabular-nums"
            style={{ color: entry.type === 'activity' ? GREEN : 'rgba(255,255,255,0.7)', cursor: isWater ? 'default' : 'text' }}
          >
            {entry.type === 'activity' ? `\u2212${entry.calories}` : entry.calories}
            <span className="text-[10px] font-normal ml-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>cal</span>
          </button>
        )}

        <AnimatePresence>
          {(hovered || showDelete) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7, width: 0 }}
              animate={{ opacity: 1, scale: 1, width: 24 }}
              exit={{ opacity: 0, scale: 0.7, width: 0 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id, entry.type); }}
              className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 active:scale-90 transition-colors"
              style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)' }}
              aria-label="Delete entry"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke={RED} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── Editable Macro Chip ── */
function MacroChip({ label, value, unit, color, onChange }: {
  label: string; value: number; unit: string; color: string; onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditVal(String(value)); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all active:scale-95"
      style={{ background: `${color}08`, border: `1px solid ${editing ? `${color}40` : `${color}15`}` }}
    >
      <span className="text-[9px] font-medium" style={{ color: `${color}99` }}>{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={editVal}
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={() => { onChange(Number(editVal) || 0); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(Number(editVal) || 0); setEditing(false); } }}
          className="w-12 text-center text-[14px] font-bold bg-transparent outline-none"
          style={{ color, caretColor: color }}
        />
      ) : (
        <span className="text-[14px] font-bold" style={{ color }}>{value}</span>
      )}
      <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{unit}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ── AI Food Input Sheet (hooks at top level)          ── */
/* ═══════════════════════════════════════════════════════ */

interface AIFoodSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLog: (name: string, cal: number, protein: number, carbs: number, fat: number) => void;
  syncing: boolean;
}

function AIFoodSheet({ isOpen, onClose, onLog, syncing }: AIFoodSheetProps) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedFood | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Hook called unconditionally at top level of this component
  const { parse } = useAIFoodParser();

  useEffect(() => {
    if (isOpen) { setInput(''); setParsed(null); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [isOpen]);

  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      setIsParsing(true);
      debounceRef.current = setTimeout(async () => {
        const result = await parse(val);
        setParsed(result);
        setIsParsing(false);
      }, 600);
    } else {
      setParsed(null);
      setIsParsing(false);
    }
  }, [parse]);

  const handleSubmit = useCallback(() => {
    if (!parsed) return;
    onLog(parsed.name, parsed.calories, parsed.protein, parsed.carbs, parsed.fat);
    onClose();
  }, [parsed, onLog, onClose]);

  const updateMacro = useCallback((field: keyof ParsedFood, val: number) => {
    if (parsed) setParsed({ ...parsed, [field]: val });
  }, [parsed]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} />
          <motion.div
            initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-md mx-4 mb-6 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(16,18,24,0.98)', border: `1px solid ${CYAN_DIM}0.15)`, fontFamily: FONT_STACK }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">{'\uD83C\uDF73'}</span>
                <span className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Log Food</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${PURPLE}20`, color: PURPLE }}>AI</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>{'\u00D7'}</span>
              </button>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-3">
              <div className="relative">
                <input ref={inputRef} type="text" value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder='Type anything... "cheeseburger", "grilled salmon with rice"'
                  className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none pr-10"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${CYAN_DIM}0.15)`, color: 'rgba(255,255,255,0.9)', caretColor: CYAN }} />
                {isParsing && (
                  <motion.div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: `${PURPLE}60`, borderTopColor: 'transparent' }}
                    animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                )}
              </div>
              <AnimatePresence mode="wait">
                {parsed && (
                  <motion.div key="parsed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl p-3.5" style={{ background: `${CYAN_DIM}0.04)`, border: `1px solid ${CYAN_DIM}0.1)` }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{parsed.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                        background: parsed.confidence > 0.8 ? `${GREEN}15` : `${ORANGE}15`,
                        color: parsed.confidence > 0.8 ? GREEN : ORANGE,
                      }}>{parsed.confidence > 0.8 ? 'High match' : 'Estimated'}</span>
                    </div>
                    {parsed.servingSize && (
                      <span className="text-[10px] block mb-2.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Serving: {parsed.servingSize} {'\u00B7'} Tap values to adjust
                      </span>
                    )}
                    <div className="flex gap-2">
                      <MacroChip label="Calories" value={parsed.calories} unit="kcal" color={CYAN} onChange={(v) => updateMacro('calories', v)} />
                      <MacroChip label="Protein" value={parsed.protein} unit="g" color={GREEN} onChange={(v) => updateMacro('protein', v)} />
                      <MacroChip label="Carbs" value={parsed.carbs} unit="g" color={ORANGE} onChange={(v) => updateMacro('carbs', v)} />
                      <MacroChip label="Fat" value={parsed.fat} unit="g" color={RED} onChange={(v) => updateMacro('fat', v)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={handleSubmit} disabled={!parsed || syncing}
                className="w-full py-3.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
                style={{
                  background: parsed ? `${CYAN_DIM}0.12)` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${parsed ? `${CYAN_DIM}0.25)` : 'rgba(255,255,255,0.06)'}`,
                  color: parsed ? CYAN : 'rgba(255,255,255,0.3)',
                }}>
                {syncing ? (
                  <><motion.div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: `${CYAN}60`, borderTopColor: 'transparent' }}
                    animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />Syncing...</>
                ) : 'Log Food'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ── AI Exercise Input Sheet (hooks at top level)      ── */
/* ═══════════════════════════════════════════════════════ */

interface AIExerciseSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onLog: (name: string, duration: number, calories: number, type: string) => void;
  syncing: boolean;
}

function AIExerciseSheet({ isOpen, onClose, onLog, syncing }: AIExerciseSheetProps) {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedExercise | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Hook called unconditionally at top level of this component
  const { parse } = useAIExerciseParser();

  useEffect(() => {
    if (isOpen) { setInput(''); setParsed(null); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [isOpen]);

  const handleInputChange = useCallback((val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length >= 2) {
      setIsParsing(true);
      debounceRef.current = setTimeout(async () => {
        const result = await parse(val);
        setParsed(result);
        setIsParsing(false);
      }, 600);
    } else {
      setParsed(null);
      setIsParsing(false);
    }
  }, [parse]);

  const handleSubmit = useCallback(() => {
    if (!parsed) return;
    onLog(parsed.name, parsed.duration, parsed.calories, parsed.type);
    onClose();
  }, [parsed, onLog, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} />
          <motion.div
            initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-md mx-4 mb-6 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(16,18,24,0.98)', border: `1px solid ${GREEN}20`, fontFamily: FONT_STACK }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">{'\uD83C\uDFC3'}</span>
                <span className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Log Exercise</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${PURPLE}20`, color: PURPLE }}>AI</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>{'\u00D7'}</span>
              </button>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-3">
              <div className="relative">
                <input ref={inputRef} type="text" value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder='"Ran 3 miles in 30 min", "45 min yoga", "lifted weights"'
                  className="w-full px-4 py-3.5 rounded-xl text-[14px] outline-none pr-10"
                  style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${GREEN}15`, color: 'rgba(255,255,255,0.9)', caretColor: GREEN }} />
                {isParsing && (
                  <motion.div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: `${PURPLE}60`, borderTopColor: 'transparent' }}
                    animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                )}
              </div>
              <AnimatePresence mode="wait">
                {parsed && (
                  <motion.div key="parsed-ex" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl p-3.5" style={{ background: `${GREEN}06`, border: `1px solid ${GREEN}12` }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{parsed.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: `${GREEN}15`, color: GREEN }}>{parsed.type}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 text-center rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-[16px] font-bold block" style={{ color: GREEN }}>{parsed.duration}</span>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>min</span>
                      </div>
                      <div className="flex-1 text-center rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <span className="text-[16px] font-bold block" style={{ color: ORANGE }}>{parsed.calories}</span>
                        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>cal burned</span>
                      </div>
                      {parsed.distance && (
                        <div className="flex-1 text-center rounded-lg py-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <span className="text-[16px] font-bold block" style={{ color: CYAN }}>{parsed.distance}</span>
                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>miles</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] block mt-2 text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {parsed.confidence > 0.8 ? 'AI-calculated from activity database' : 'Estimated \u2014 values may vary'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <button onClick={handleSubmit} disabled={!parsed || syncing}
                className="w-full py-3.5 rounded-xl text-[13px] font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
                style={{
                  background: parsed ? `${GREEN}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${parsed ? `${GREEN}30` : 'rgba(255,255,255,0.06)'}`,
                  color: parsed ? GREEN : 'rgba(255,255,255,0.3)',
                }}>
                {syncing ? (
                  <><motion.div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: `${GREEN}60`, borderTopColor: 'transparent' }}
                    animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />Syncing...</>
                ) : 'Log Exercise'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Water Log Sheet ── */
function WaterSheet({ isOpen, onClose, onLog, syncing }: {
  isOpen: boolean; onClose: () => void; onLog: (ml: number) => void; syncing: boolean;
}) {
  const presets = [250, 500, 750, 1000];
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }} />
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-w-md mx-4 mb-6 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(16,18,24,0.98)', border: '1px solid rgba(0,180,216,0.15)', fontFamily: FONT_STACK }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[18px]">{'\uD83D\uDCA7'}</span>
                <span className="text-[15px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Log Water</span>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>{'\u00D7'}</span>
              </button>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              {presets.map((ml) => (
                <button key={ml} onClick={() => { onLog(ml); onClose(); }} disabled={syncing}
                  className="py-4 rounded-xl text-center transition-all duration-200 active:scale-95 disabled:opacity-50"
                  style={{ background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.15)' }}>
                  <span className="text-[18px] font-bold block" style={{ color: '#00B4D8' }}>{ml}ml</span>
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {ml < 500 ? 'Small glass' : ml < 750 ? 'Large glass' : ml < 1000 ? 'Bottle' : 'Full liter'}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ── Sticky Daily Total Footer                         ── */
/* ═══════════════════════════════════════════════════════ */

interface DailyTotalBarProps {
  totalFood: number;
  totalExercise: number;
  calorieGoal: number;
}

function DailyTotalBar({ totalFood, totalExercise, calorieGoal }: DailyTotalBarProps) {
  const net = totalFood - totalExercise;
  const netColor = net > calorieGoal ? RED : net > calorieGoal * 0.85 ? ORANGE : CYAN;
  const borderColor = net > calorieGoal ? 'rgba(255,69,58,0.25)' : net > calorieGoal * 0.85 ? 'rgba(255,159,10,0.25)' : `${CYAN_DIM}0.2)`;
  const glowColor = net > calorieGoal ? 'rgba(255,69,58,0.15)' : net > calorieGoal * 0.85 ? 'rgba(255,159,10,0.12)' : 'rgba(0,240,255,0.12)';
  const glowSpread = net > calorieGoal ? 'rgba(255,69,58,0.06)' : net > calorieGoal * 0.85 ? 'rgba(255,159,10,0.05)' : 'rgba(0,240,255,0.05)';

  return (
    <div
      className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-40px)] max-w-[600px]"
      style={{ fontFamily: FONT_STACK }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl px-5 py-3.5 flex items-center justify-between"
        style={{
          background: 'rgba(12,14,18,0.94)',
          border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: `0 -4px 32px rgba(0,0,0,0.4), 0 0 40px ${glowColor}, 0 0 80px ${glowSpread}, 0 0 0 0.5px rgba(255,255,255,0.04) inset`,
        }}
      >
        {/* Food In */}
        <div className="flex flex-col items-center">
          <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'rgba(255,255,255,0.88)' }}>
            {totalFood.toLocaleString()}
          </span>
          <span className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>eaten</span>
        </div>

        <span className="text-[16px] font-light" style={{ color: 'rgba(255,255,255,0.15)' }}>{'\u2212'}</span>

        {/* Exercise Out */}
        <div className="flex flex-col items-center">
          <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: GREEN }}>
            {totalExercise.toLocaleString()}
          </span>
          <span className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>burned</span>
        </div>

        <span className="text-[16px] font-light" style={{ color: 'rgba(255,255,255,0.15)' }}>=</span>

        {/* Net Progress — most prominent */}
        <div className="flex flex-col items-center">
          <span className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: netColor }}>
            {net.toLocaleString()}
          </span>
          <span className="text-[10px] font-semibold mt-0.5" style={{ color: `${netColor}99` }}>net cal</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ── Helper: Derive AI macro tag from food entry       ── */
/* ═══════════════════════════════════════════════════════ */
function deriveMacroTag(entry: { protein?: number; carbs?: number; fat?: number; calories: number; name: string }): { tag?: string; tagColor?: string } {
  const p = entry.protein || 0;
  const c = entry.carbs || 0;
  const f = entry.fat || 0;

  if (p >= 30) return { tag: 'High Protein', tagColor: GREEN };
  if (c >= 50 && p < 15) return { tag: 'High Carb', tagColor: ORANGE };
  if (f >= 25) return { tag: 'High Fat', tagColor: '#FFB86B' };
  if (entry.calories <= 200 && p >= 10) return { tag: 'Light & Lean', tagColor: CYAN };
  if (entry.calories >= 600) return { tag: 'Heavy Meal', tagColor: RED };

  const lower = entry.name.toLowerCase();
  if (lower.includes('salad') || lower.includes('veggie') || lower.includes('greens')) return { tag: 'Plant-Based', tagColor: GREEN };
  if (lower.includes('protein') || lower.includes('whey') || lower.includes('shake')) return { tag: 'Supplement', tagColor: PURPLE };

  return {};
}

function deriveExerciseTag(entry: { duration?: number; calories: number; exerciseType?: string }): { tag?: string; tagColor?: string } {
  const t = entry.exerciseType?.toLowerCase() || '';
  if (t.includes('cardio') || t.includes('run') || t.includes('cycling')) return { tag: 'Cardio', tagColor: CYAN };
  if (t.includes('strength') || t.includes('weight') || t.includes('lift')) return { tag: 'Strength', tagColor: ORANGE };
  if (t.includes('yoga') || t.includes('stretch') || t.includes('flexibility')) return { tag: 'Recovery', tagColor: PURPLE };
  if (entry.calories >= 400) return { tag: 'High Burn', tagColor: RED };
  if ((entry.duration || 0) >= 45) return { tag: 'Endurance', tagColor: GREEN };
  return {};
}

/* ═══════════════════════════════════════════════════════ */
/* ── Main JournalView — All hooks at top level         ── */
/* ═══════════════════════════════════════════════════════ */
const JournalView: React.FC = () => {
  /* ── Session ID (stable across renders) ── */
  const [sessionId] = useState(() => getTwinSessionId());

  /* ── Date state ── */
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState(today);

  /* ── Sheet visibility state ── */
  const [showWater, setShowWater] = useState(false);
  const [showMeal, setShowMeal] = useState(false);
  const [showExercise, setShowExercise] = useState(false);

  /* ── Syncing state ── */
  const [syncingWater, setSyncingWater] = useState(false);
  const [syncingMeal, setSyncingMeal] = useState(false);
  const [syncingExercise, setSyncingExercise] = useState(false);

  /* ── Toast state ── */
  const [toast, setToast] = useState<{ message: string; visible: boolean; variant: 'success' | 'syncing' | 'error' }>({ message: '', visible: false, variant: 'success' });

  /* ── All hooks called unconditionally at top level ── */
  const foodLogs = useQuery(api.queries.getTodayFoodLogs, { sessionId });
  const activityLogs = useQuery(api.queries.getTodayActivityLogs, { sessionId });
  const waterLogs = useQuery(api.queries.getTodayWaterLogs, { sessionId });

  const logWater = useMutation(api.mutations.logWaterIntake);
  const logMeal = useMutation(api.mutations.logQuickMeal);
  const logExercise = useMutation(api.mutations.logQuickExercise);
  const updateFood = useMutation(api.mutations.updateFoodLog);
  const deleteFood = useMutation(api.mutations.deleteFoodLog);
  const updateActivity = useMutation(api.mutations.updateActivityLog);
  const deleteActivity = useMutation(api.mutations.deleteActivityLog);

  /* ── Toast helper ── */
  const showToast = useCallback((message: string, variant: 'success' | 'syncing' | 'error' = 'success') => {
    setToast({ message, visible: true, variant });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2500);
  }, []);

  /* ── Log handlers ── */
  const handleLogWater = useCallback(async (ml: number) => {
    setSyncingWater(true);
    showToast(`Syncing ${ml}ml water...`, 'syncing');
    try {
      await logWater({ sessionId, amountMl: ml });
      showToast(`${ml}ml water synced to cloud`);
    } catch (err) {
      console.error('[JOURNAL] Water log error:', err);
      showToast('Failed to sync water log', 'error');
    } finally { setSyncingWater(false); }
  }, [logWater, sessionId, showToast]);

  const handleLogMeal = useCallback(async (name: string, cal: number, protein: number, carbs: number, fat: number) => {
    setSyncingMeal(true);
    showToast(`Syncing "${name}"...`, 'syncing');
    try {
      await logMeal({ sessionId, name, calories: cal, protein, carbs, fat });
      showToast(`"${name}" synced to cloud`);
    } catch (err) {
      console.error('[JOURNAL] Meal log error:', err);
      showToast('Failed to sync meal', 'error');
    } finally { setSyncingMeal(false); }
  }, [logMeal, sessionId, showToast]);

  const handleLogExercise = useCallback(async (name: string, duration: number, calories: number, type: string) => {
    setSyncingExercise(true);
    showToast(`Syncing "${name}"...`, 'syncing');
    try {
      await logExercise({ sessionId, name, duration, calories, type });
      showToast(`"${name}" synced to cloud`);
    } catch (err) {
      console.error('[JOURNAL] Exercise log error:', err);
      showToast('Failed to sync exercise', 'error');
    } finally { setSyncingExercise(false); }
  }, [logExercise, sessionId, showToast]);

  /* ── Inline Edit Handlers ── */
  const handleUpdateName = useCallback(async (id: string, type: LogEntryType, name: string) => {
    try {
      if (type === 'food') {
        await updateFood({ id: id as any, name });
      } else if (type === 'activity') {
        await updateActivity({ id: id as any, name });
      }
      showToast('Updated', 'success');
    } catch (err) {
      console.error('[JOURNAL] Update name error:', err);
      showToast('Failed to update', 'error');
    }
  }, [updateFood, updateActivity, showToast]);

  const handleUpdateCalories = useCallback(async (id: string, type: LogEntryType, calories: number) => {
    try {
      if (type === 'food') {
        await updateFood({ id: id as any, calories });
      } else if (type === 'activity') {
        await updateActivity({ id: id as any, calories });
      }
      showToast('Updated', 'success');
    } catch (err) {
      console.error('[JOURNAL] Update calories error:', err);
      showToast('Failed to update', 'error');
    }
  }, [updateFood, updateActivity, showToast]);

  const handleDelete = useCallback(async (id: string, type: LogEntryType) => {
    try {
      if (type === 'food') {
        await deleteFood({ id: id as any });
      } else if (type === 'activity') {
        await deleteActivity({ id: id as any });
      }
      showToast('Entry removed', 'success');
    } catch (err) {
      console.error('[JOURNAL] Delete error:', err);
      showToast('Failed to delete', 'error');
    }
  }, [deleteFood, deleteActivity, showToast]);

  /* ── Computed totals (useMemo, no hooks inside) ── */
  const totalFoodCal = useMemo(() => (foodLogs || []).reduce((s, f) => s + f.calories, 0), [foodLogs]);
  const totalProtein = useMemo(() => (foodLogs || []).reduce((s, f) => s + f.protein, 0), [foodLogs]);
  const totalExerciseCal = useMemo(() => (activityLogs || []).reduce((s, a) => s + a.calories, 0), [activityLogs]);
  const totalWaterMl = useMemo(() => (waterLogs || []).reduce((s, w) => s + (w.numericValue || 0), 0), [waterLogs]);
  const calorieGoal = 2400;

  const isLoading = foodLogs === undefined || activityLogs === undefined || waterLogs === undefined;
  const anySyncing = syncingWater || syncingMeal || syncingExercise;

  /* ── Build Today's Log entries (pure computation, no hooks) ── */
  const entries: TodaysLogEntry[] = useMemo(() => {
    const list: TodaysLogEntry[] = [];

    (foodLogs || []).forEach((f) => {
      const { tag, tagColor } = deriveMacroTag({ protein: f.protein, carbs: f.carbs, fat: f.fat, calories: f.calories, name: f.name });
      list.push({
        id: f._id,
        type: 'food',
        icon: '\uD83C\uDF73',
        name: f.name,
        calories: f.calories,
        time: new Date(f.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        loggedAt: f.loggedAt,
        tag,
        tagColor,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
      });
    });

    (activityLogs || []).forEach((a) => {
      const { tag, tagColor } = deriveExerciseTag({ duration: a.duration, calories: a.calories, exerciseType: a.type });
      list.push({
        id: a._id,
        type: 'activity',
        icon: '\uD83C\uDFC3',
        name: a.name,
        calories: a.calories,
        time: new Date(a.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        loggedAt: a.loggedAt,
        tag,
        tagColor,
        duration: a.duration,
        exerciseType: a.type,
      });
    });

    (waterLogs || []).forEach((w) => {
      list.push({
        id: w._id,
        type: 'water',
        icon: '\uD83D\uDCA7',
        name: `${w.numericValue || 0}ml Water`,
        calories: 0,
        time: new Date(w.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        loggedAt: w.loggedAt,
      });
    });

    return list.sort((a, b) => b.loggedAt - a.loggedAt);
  }, [foodLogs, activityLogs, waterLogs]);

  const isToday = selectedDate === today;
  const hasCalorieData = totalFoodCal > 0 || totalExerciseCal > 0;

  /* ═══════════════════════════════════════════════ */
  /* ── RENDER                                     ── */
  /* ═══════════════════════════════════════════════ */
  return (
    <div className="pb-48 max-w-[640px] mx-auto px-5" style={{ fontFamily: FONT_STACK }}>
      {/* Header */}
      <div className="pt-2 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight mb-0.5" style={{ color: 'rgba(255,255,255,0.92)' }}>Journal</h1>
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>AI-powered health ledger</p>
          </div>
          <div className="flex items-center gap-2">
            {anySyncing ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: `${ORANGE}12`, border: `1px solid ${ORANGE}25` }}>
                <motion.div className="w-2 h-2 rounded-full border border-t-transparent"
                  style={{ borderColor: `${ORANGE}80`, borderTopColor: 'transparent' }}
                  animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                <span className="text-[9px] font-semibold" style={{ color: `${ORANGE}cc` }}>Syncing</span>
              </motion.div>
            ) : !isLoading ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.15)' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}80` }} />
                <span className="text-[9px] font-semibold" style={{ color: `${GREEN}cc` }}>Live</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Ambient Health Stats */}
      {isToday && <AIStatHeader />}

      {/* Date Scroller */}
      <div className="mb-4"><DateScroller selectedDate={selectedDate} onSelect={setSelectedDate} /></div>

      {/* Calorie Equation Bar */}
      {isToday && <div className="mb-4"><CalorieBar goal={calorieGoal} food={totalFoodCal} exercise={totalExerciseCal} /></div>}

      {/* Quick Add Buttons */}
      {isToday && (
        <div className="flex gap-2 mb-4">
          {[
            { icon: '\uD83D\uDCA7', label: 'Water', color: '#00B4D8', onClick: () => setShowWater(true), syncing: syncingWater, ai: false },
            { icon: '\uD83C\uDF73', label: 'Food', color: CYAN, onClick: () => setShowMeal(true), syncing: syncingMeal, ai: true },
            { icon: '\uD83C\uDFC3', label: 'Exercise', color: GREEN, onClick: () => setShowExercise(true), syncing: syncingExercise, ai: true },
          ].map((btn) => (
            <button key={btn.label} onClick={btn.onClick} disabled={btn.syncing}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-200 active:scale-95 relative disabled:opacity-60"
              style={{ background: `${btn.color}08`, border: `1px solid ${btn.color}20` }}>
              <span className="text-[14px]">{btn.icon}</span>
              <span className="text-[12px] font-semibold" style={{ color: `${btn.color}cc` }}>{btn.label}</span>
              {btn.ai && (
                <span className="text-[8px] px-1 py-0.5 rounded-full font-bold" style={{ background: `${PURPLE}20`, color: PURPLE }}>AI</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Water Summary */}
      {isToday && totalWaterMl > 0 && (
        <div className="mb-4 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.12)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[16px]">{'\uD83D\uDCA7'}</span>
            <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Water today</span>
          </div>
          <span className="text-[15px] font-bold" style={{ color: '#00B4D8' }}>
            {totalWaterMl >= 1000 ? `${(totalWaterMl / 1000).toFixed(1)}L` : `${totalWaterMl}ml`}
          </span>
        </div>
      )}

      {/* Macro Summary */}
      {isToday && totalFoodCal > 0 && (
        <div className="mb-4 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: `${CYAN_DIM}0.04)`, border: `1px solid ${CYAN_DIM}0.1)` }}>
          <div className="flex items-center gap-2">
            <span className="text-[16px]">{'\uD83E\uDD69'}</span>
            <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>Protein today</span>
          </div>
          <span className="text-[15px] font-bold" style={{ color: CYAN }}>{totalProtein}g / 160g</span>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* ── Today's Log — Minimalist Diary Cards      ── */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {isToday ? "Today's Log" : selectedDate}
          </span>
          <span className="text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {isLoading ? 'Loading...' : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </div>

        {isLoading ? (
          <div className="rounded-2xl py-12 flex flex-col items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <motion.div className="w-6 h-6 rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${CYAN}40`, borderTopColor: 'transparent' }}
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
            <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading your journal...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl py-14 flex flex-col items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.06)' }}>
            <span className="text-[28px] opacity-60">{'\uD83D\uDCDD'}</span>
            <p className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {isToday ? 'No entries yet today' : 'No entries for this day'}
            </p>
            {isToday && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>Tap a button above to start logging</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {entries.map((entry) => (
                <TodaysLogCard
                  key={entry.id}
                  entry={entry}
                  onUpdateName={handleUpdateName}
                  onUpdateCalories={handleUpdateCalories}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Bottom Sheets (rendered as portals via fixed positioning) ── */}
      <WaterSheet isOpen={showWater} onClose={() => setShowWater(false)} onLog={handleLogWater} syncing={syncingWater} />
      <AIFoodSheet isOpen={showMeal} onClose={() => setShowMeal(false)} onLog={handleLogMeal} syncing={syncingMeal} />
      <AIExerciseSheet isOpen={showExercise} onClose={() => setShowExercise(false)} onLog={handleLogExercise} syncing={syncingExercise} />

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} variant={toast.variant} />

      {/* ═══════════════════════════════════════════════ */}
      {/* ── Daily Total — Sticky Bottom Summary Bar    ── */}
      {/* ═══════════════════════════════════════════════ */}
      {isToday && !isLoading && hasCalorieData && (
        <DailyTotalBar totalFood={totalFoodCal} totalExercise={totalExerciseCal} calorieGoal={calorieGoal} />
      )}
    </div>
  );
};

export default JournalView;
