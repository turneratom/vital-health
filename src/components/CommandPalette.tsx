import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { getSessionId } from "@/components/Presence/usePresenceState";

/* ══════════════════════════════════════════════════════════════ */
/*  CommandPalette — Cmd+K Power-User Interface                  */
/*  • Search peers by name/handle                                */
/*  • Jump to biometric metrics (HRV, Sleep, Recovery, etc.)     */
/*  • Trigger protocols (Sync HRV, Toggle Redline, Breathwork)   */
/*  • Full keyboard navigation with spring animations            */
/* ══════════════════════════════════════════════════════════════ */

const T = {
  cyan: "#00F0FF",
  green: "#00FFCC",
  violet: "#AF82FF",
  gold: "#C4A46C",
  red: "#FF6B6B",
  amber: "#FFB86B",
  textHi: "rgba(255,255,255,0.92)",
  textMid: "rgba(255,255,255,0.55)",
  textLo: "rgba(255,255,255,0.28)",
  surface: "rgba(8,10,14,0.97)",
  surfaceHover: "rgba(0,240,255,0.06)",
};

const SPRING = { type: "spring" as const, stiffness: 400, damping: 32, mass: 0.8 };
const SPRING_GENTLE = { type: "spring" as const, stiffness: 260, damping: 26, mass: 1 };

/* ── Command item types ── */
type CommandCategory = "peers" | "metrics" | "protocols" | "navigation";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: CommandCategory;
  keywords: string[];
  color: string;
  action: () => void;
}

/* ── Category labels ── */
const CATEGORY_LABELS: Record<CommandCategory, { label: string; icon: string }> = {
  protocols: { label: "PROTOCOLS", icon: "⚡" },
  metrics: { label: "BIOMETRIC METRICS", icon: "♡" },
  navigation: { label: "NAVIGATION", icon: "◎" },
  peers: { label: "PEERS", icon: "◬" },
};

const CATEGORY_ORDER: CommandCategory[] = ["protocols", "metrics", "navigation", "peers"];

/* ── Fuzzy match scoring ── */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  if (t.includes(q)) return 70;
  // Check each keyword character appears in order
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

function matchItem(query: string, item: CommandItem): number {
  if (!query) return 50; // Show all when empty
  let best = fuzzyScore(query, item.label);
  best = Math.max(best, fuzzyScore(query, item.description) * 0.8);
  for (const kw of item.keywords) {
    best = Math.max(best, fuzzyScore(query, kw) * 0.9);
  }
  return best;
}

/* ══════════════════════════════════════════════════════════════ */
/*  Main Component                                               */
/* ══════════════════════════════════════════════════════════════ */

interface CommandPaletteProps {
  onNavigate?: (viewId: string) => void;
  onToggleRedline?: () => void;
  onStartProtocol?: (protocol: string) => void;
}

export function CommandPalette({ onNavigate, onToggleRedline, onStartProtocol }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sessionId = getSessionId();

  /* ── Fetch peers from Convex ── */
  const presenceList = useQuery(api.queries.listPresence) ?? [];
  const peersList = useQuery(api.queries.listPeers) ?? [];

  /* ── Build command items ── */
  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    /* ── Home / visit prep (demo entry points) ── */
    items.push({
      id: "morning-brief",
      label: "Morning Brief",
      description: "Open daily directives & protocol brief (home)",
      icon: "☀",
      category: "protocols",
      keywords: ["morning", "brief", "directives", "daily", "home", "today"],
      color: T.cyan,
      action: () => {
        window.dispatchEvent(new CustomEvent("vive-open-morning-brief"));
        setIsOpen(false);
      },
    });

    items.push({
      id: "doctor-visit-prep",
      label: "Doctor Visit Prep",
      description: "Export visit packet from Bio-Resume (JSON / printable)",
      icon: "📋",
      category: "protocols",
      keywords: ["doctor", "visit", "packet", "export", "prep", "clinic", "json"],
      color: T.gold,
      action: () => {
        window.dispatchEvent(new CustomEvent("vive-open-visit-packet"));
        setIsOpen(false);
      },
    });

    items.push({
      id: "manual-vitals-quick-log",
      label: "Manual Vitals / Quick Log",
      description: "Enter HR, HRV, sleep, steps, food (wearables coming later)",
      icon: "⚡",
      category: "protocols",
      keywords: ["manual", "vitals", "quick", "log", "hr", "hrv", "sleep", "food", "meal"],
      color: T.cyan,
      action: () => {
        window.dispatchEvent(new CustomEvent("vive-open-quick-log"));
        setIsOpen(false);
      },
    });

    items.push({
      id: "biovault-paste",
      label: "Bio-Vault (Paste Labs)",
      description: "Paste lab text → parse → sync to vault",
      icon: "◈",
      category: "protocols",
      keywords: ["biovault", "vault", "paste", "labs", "blood", "panel"],
      color: T.green,
      action: () => {
        onNavigate?.("biovault");
        setIsOpen(false);
      },
    });

    items.push({
      id: "food-quick-log",
      label: "Food / Quick Log",
      description: "Open journal for food, water & exercise text logs",
      icon: "🥗",
      category: "protocols",
      keywords: ["food", "meal", "journal", "log", "nutrition", "water"],
      color: T.gold,
      action: () => {
        onNavigate?.("journal");
        setIsOpen(false);
      },
    });

    /* ── Protocol commands ── */
    items.push({
      id: "sync-hrv",
      label: "Sync HRV (Coming later)",
      description: "Wearable OAuth not live — use Manual Vitals / Quick Log instead",
      icon: "💓",
      category: "protocols",
      keywords: ["sync", "hrv", "heart", "variability", "wearable", "oura", "whoop", "coming later"],
      color: T.red,
      action: () => {
        window.dispatchEvent(new CustomEvent("vive-open-quick-log"));
        setIsOpen(false);
      },
    });

    items.push({
      id: "toggle-redline",
      label: "Toggle Redline Overlay",
      description: "Show/hide critical biomarker alert overlay on canvas",
      icon: "🔴",
      category: "protocols",
      keywords: ["redline", "overlay", "alert", "critical", "toggle", "warning"],
      color: T.red,
      action: () => {
        onToggleRedline?.();
        window.dispatchEvent(new CustomEvent("vive-toggle-redline"));
        setIsOpen(false);
      },
    });

    items.push({
      id: "breathwork",
      label: "Start Breathwork",
      description: "Initiate 5-minute focused breathing protocol",
      icon: "🌬️",
      category: "protocols",
      keywords: ["breathwork", "breathing", "breath", "focus", "calm", "recovery", "wim hof", "box"],
      color: T.cyan,
      action: () => {
        onStartProtocol?.("breathwork");
        window.dispatchEvent(new CustomEvent("vive-start-protocol", { detail: { protocol: "breathwork", duration: 300 } }));
        setIsOpen(false);
      },
    });

    items.push({
      id: "cold-exposure",
      label: "Cold Exposure Protocol",
      description: "Begin cold plunge or cold shower timer",
      icon: "🧊",
      category: "protocols",
      keywords: ["cold", "exposure", "plunge", "shower", "ice", "cryo"],
      color: T.cyan,
      action: () => {
        onStartProtocol?.("cold-exposure");
        window.dispatchEvent(new CustomEvent("vive-start-protocol", { detail: { protocol: "cold-exposure", duration: 180 } }));
        setIsOpen(false);
      },
    });

    items.push({
      id: "deep-work",
      label: "Enter Deep Work",
      description: "Activate focus mode — dims UI, notifies peers",
      icon: "🎯",
      category: "protocols",
      keywords: ["deep", "work", "focus", "flow", "concentrate", "zone"],
      color: T.violet,
      action: () => {
        onStartProtocol?.("deep-work");
        window.dispatchEvent(new CustomEvent("vive-focus-mode", { detail: { enabled: true } }));
        setIsOpen(false);
      },
    });

    items.push({
      id: "hydration",
      label: "Log Hydration",
      description: "Quick-log water intake (250ml)",
      icon: "💧",
      category: "protocols",
      keywords: ["hydration", "water", "drink", "fluid", "log"],
      color: T.cyan,
      action: () => {
        onStartProtocol?.("hydration");
        window.dispatchEvent(new CustomEvent("vive-quick-log", { detail: { type: "hydration", amount: 250 } }));
        setIsOpen(false);
      },
    });

    items.push({
      id: "supplement-stack",
      label: "Log Supplement Stack",
      description: "Record daily supplement intake",
      icon: "💊",
      category: "protocols",
      keywords: ["supplement", "stack", "vitamin", "creatine", "omega", "magnesium"],
      color: T.gold,
      action: () => {
        onStartProtocol?.("supplements");
        window.dispatchEvent(new CustomEvent("vive-quick-log", { detail: { type: "supplements" } }));
        setIsOpen(false);
      },
    });

    /* ── Biometric metric jumps ── */
    const metrics: { id: string; label: string; desc: string; icon: string; kw: string[]; color: string; view: string }[] = [
      { id: "m-hrv", label: "HRV Overview", desc: "Heart rate variability trends & analysis", icon: "📈", kw: ["hrv", "heart", "variability", "trend"], color: T.green, view: "vitals" },
      { id: "m-sleep", label: "Sleep Analysis", desc: "Sleep score, deep/REM breakdown", icon: "😴", kw: ["sleep", "rem", "deep", "score", "rest"], color: T.violet, view: "vitals" },
      { id: "m-recovery", label: "Recovery Score", desc: "Overall recovery & readiness metrics", icon: "🔋", kw: ["recovery", "readiness", "strain", "rest"], color: T.green, view: "vitals" },
      { id: "m-strain", label: "Strain Index", desc: "Cardiovascular load & training stress", icon: "🔥", kw: ["strain", "load", "stress", "training", "cardiovascular"], color: T.amber, view: "activity" },
      { id: "m-nutrition", label: "Nutrition Macros", desc: "Calories, protein, carbs, fat breakdown", icon: "🥗", kw: ["nutrition", "macros", "calories", "protein", "carbs", "fat", "diet"], color: T.gold, view: "nutrition" },
      { id: "m-body-battery", label: "Body Battery", desc: "Energy reserves throughout the day", icon: "⚡", kw: ["body", "battery", "energy", "reserves"], color: T.amber, view: "vitals" },
      { id: "m-spo2", label: "Blood Oxygen (SpO2)", desc: "Oxygen saturation levels", icon: "🫁", kw: ["spo2", "oxygen", "saturation", "blood"], color: T.cyan, view: "vitals" },
      { id: "m-cortisol", label: "Cortisol Levels", desc: "Stress hormone tracking from labs", icon: "🧪", kw: ["cortisol", "stress", "hormone", "lab"], color: T.red, view: "biovault" },
      { id: "m-weight", label: "Weight & Composition", desc: "Body weight, lean mass, body fat %", icon: "⚖️", kw: ["weight", "body", "composition", "fat", "lean", "mass"], color: T.gold, view: "progress" },
    ];

    for (const m of metrics) {
      items.push({
        id: m.id,
        label: m.label,
        description: m.desc,
        icon: m.icon,
        category: "metrics",
        keywords: m.kw,
        color: m.color,
        action: () => {
          onNavigate?.(m.view);
          setIsOpen(false);
        },
      });
    }

    /* ── Navigation shortcuts ── */
    const navItems: { id: string; label: string; desc: string; icon: string; kw: string[]; view: string }[] = [
      { id: "n-dashboard", label: "Command Center", desc: "Home — Morning Brief & Visit Prep", icon: "⬡", kw: ["home", "dashboard", "main", "overview"], view: "dashboard" },
      { id: "n-biovault", label: "Bio-Vault (Paste Labs)", desc: "Paste lab text into vault", icon: "◈", kw: ["vault", "bio", "paste", "labs"], view: "biovault" },
      { id: "n-vitals", label: "Manual Vitals", desc: "Enter vitals manually (wearables coming later)", icon: "♡", kw: ["vitals", "manual", "hrv"], view: "vitals" },
      { id: "n-briefing", label: "Briefing Room", desc: "AI coaching & chat", icon: "◉", kw: ["briefing", "ai", "chat", "coach"], view: "briefing" },
      { id: "n-journal", label: "Food / Quick Log", desc: "Food, water & exercise text logs", icon: "📓", kw: ["journal", "log", "food", "water", "meal"], view: "journal" },
      { id: "n-protocols", label: "Protocol Library", desc: "Browse all health protocols", icon: "✦", kw: ["protocol", "library", "browse", "all"], view: "protocols" },
      { id: "n-community", label: "Community", desc: "Network & leaderboard", icon: "👥", kw: ["community", "social", "network", "leaderboard"], view: "community" },
      { id: "n-report", label: "Weekly Report", desc: "Performance summary", icon: "📊", kw: ["report", "weekly", "summary", "review"], view: "report" },
      { id: "n-dna", label: "DNA Insights", desc: "Genetic analysis", icon: "🧬", kw: ["dna", "genetic", "genome", "genes"], view: "dna" },
    ];

    for (const n of navItems) {
      items.push({
        id: n.id,
        label: n.label,
        description: n.desc,
        icon: n.icon,
        category: "navigation",
        keywords: n.kw,
        color: T.cyan,
        action: () => {
          onNavigate?.(n.view);
          setIsOpen(false);
        },
      });
    }

    /* ── Peers from presence + peers table ── */
    const seenPeers = new Set<string>();

    for (const p of peersList) {
      if (seenPeers.has(p.handle)) continue;
      seenPeers.add(p.handle);
      items.push({
        id: `peer-${p._id}`,
        label: p.name,
        description: `@${p.handle} · ${p.tier} · ${p.status}`,
        icon: p.avatar,
        category: "peers",
        keywords: [p.name.toLowerCase(), p.handle.toLowerCase(), p.tier.toLowerCase(), p.status.toLowerCase()],
        color: T.green,
        action: () => {
          onNavigate?.("community");
          setIsOpen(false);
        },
      });
    }

    for (const p of presenceList) {
      if (p.sessionId === sessionId) continue;
      const sid = p.sessionId.slice(0, 8);
      if (seenPeers.has(sid)) continue;
      seenPeers.add(sid);
      items.push({
        id: `presence-${p.sessionId}`,
        label: `Peer ${sid}`,
        description: `Online · ${p.activeProtocol || "Idle"} · ${p.auraState || "neutral"}`,
        icon: "👤",
        category: "peers",
        keywords: [sid, p.activeProtocol || "", p.auraState || "", "peer", "online", "active"],
        color: p.color || T.cyan,
        action: () => {
          // Dispatch event to pan FluidCanvas to this peer
          window.dispatchEvent(new CustomEvent("vive-pan-to-peer", { detail: { sessionId: p.sessionId, x: p.x, y: p.y } }));
          setIsOpen(false);
        },
      });
    }

    return items;
  }, [peersList, presenceList, sessionId, onNavigate, onToggleRedline, onStartProtocol]);

  /* ── Filtered + scored results ── */
  const filteredItems = useMemo(() => {
    const scored = commandItems
      .map((item) => ({ item, score: matchItem(query, item) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    // Group by category in order
    const grouped: { category: CommandCategory; items: CommandItem[] }[] = [];
    const catMap = new Map<CommandCategory, CommandItem[]>();

    for (const { item } of scored) {
      if (!catMap.has(item.category)) catMap.set(item.category, []);
      catMap.get(item.category)!.push(item);
    }

    for (const cat of CATEGORY_ORDER) {
      const items = catMap.get(cat);
      if (items && items.length > 0) {
        grouped.push({ category: cat, items: query ? items : items.slice(0, 5) });
      }
    }

    return grouped;
  }, [commandItems, query]);

  /* ── Flat list for keyboard navigation ── */
  const flatItems = useMemo(() => {
    return filteredItems.flatMap((g) => g.items);
  }, [filteredItems]);

  /* ── Keyboard shortcut: Cmd+K / Ctrl+K ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen((prev) => {
          if (!prev) {
            setQuery("");
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [isOpen]);

  /* ── Focus input when opened ── */
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  /* ── Reset selection when query changes ── */
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  /* ── Scroll selected item into view ── */
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  /* ── Keyboard navigation inside palette ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[selectedIndex];
        if (item) item.action();
      }
    },
    [flatItems, selectedIndex]
  );

  /* ── Execute item ── */
  const handleSelect = useCallback((item: CommandItem) => {
    item.action();
  }, []);

  /* ── Render ── */
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cmd-backdrop"
            className="fixed inset-0 z-[500]"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setIsOpen(false)}
          />

          {/* Palette container */}
          <motion.div
            key="cmd-palette"
            className="fixed z-[501] left-1/2 w-full max-w-[520px] overflow-hidden"
            style={{
              top: "min(18%, 120px)",
              transform: "translateX(-50%)",
              background: T.surface,
              border: "1px solid rgba(0,240,255,0.12)",
              borderRadius: 20,
              boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(0,240,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={SPRING}
          >
            {/* ── Search input ── */}
            <div className="relative flex items-center px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Search icon */}
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={T.cyan} strokeWidth="2" strokeLinecap="round"
                className="flex-shrink-0 mr-3"
                style={{ opacity: 0.5 }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search peers, metrics, or protocols..."
                className="flex-1 bg-transparent outline-none text-sm font-medium"
                style={{ color: T.textHi, caretColor: T.cyan }}
                autoComplete="off"
                spellCheck={false}
              />

              {/* Shortcut badge */}
              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <kbd
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: T.textLo,
                  }}
                >
                  ESC
                </kbd>
              </div>
            </div>

            {/* ── Results list ── */}
            <div
              ref={listRef}
              className="overflow-y-auto py-2"
              style={{ maxHeight: "min(60vh, 420px)" }}
            >
              {filteredItems.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <span className="text-[11px] font-medium" style={{ color: T.textLo }}>
                    No results for "{query}"
                  </span>
                </div>
              ) : (
                filteredItems.map((group) => {
                  const catMeta = CATEGORY_LABELS[group.category];
                  return (
                    <div key={group.category} className="mb-1">
                      {/* Category header */}
                      <div className="px-5 pt-2.5 pb-1.5 flex items-center gap-2">
                        <span className="text-[9px]">{catMeta.icon}</span>
                        <span
                          className="text-[9px] font-bold uppercase tracking-[0.18em]"
                          style={{ color: T.textLo }}
                        >
                          {catMeta.label}
                        </span>
                        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
                      </div>

                      {/* Items */}
                      {group.items.map((item) => {
                        const globalIdx = flatItems.indexOf(item);
                        const isSelected = globalIdx === selectedIndex;

                        return (
                          <motion.button
                            key={item.id}
                            data-idx={globalIdx}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className="w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors duration-100"
                            style={{
                              background: isSelected ? T.surfaceHover : "transparent",
                              borderLeft: isSelected ? `2px solid ${item.color}` : "2px solid transparent",
                            }}
                            layout
                            transition={SPRING_GENTLE}
                          >
                            {/* Icon */}
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                              style={{
                                background: isSelected ? `${item.color}15` : "rgba(255,255,255,0.03)",
                                border: `1px solid ${isSelected ? item.color + "30" : "rgba(255,255,255,0.05)"}`,
                                boxShadow: isSelected ? `0 0 12px ${item.color}10` : "none",
                                transition: "all 0.2s",
                              }}
                            >
                              {item.icon}
                            </div>

                            {/* Text */}
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-[13px] font-semibold leading-tight truncate"
                                style={{ color: isSelected ? T.textHi : T.textMid }}
                              >
                                {item.label}
                              </div>
                              <div
                                className="text-[10px] leading-tight mt-0.5 truncate"
                                style={{ color: T.textLo }}
                              >
                                {item.description}
                              </div>
                            </div>

                            {/* Enter hint on selected */}
                            {isSelected && (
                              <motion.kbd
                                initial={{ opacity: 0, x: 4 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{
                                  background: `${item.color}12`,
                                  border: `1px solid ${item.color}25`,
                                  color: item.color,
                                }}
                              >
                                ↵
                              </motion.kbd>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Footer ── */}
            <div
              className="px-5 py-2.5 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded text-[8px] font-bold" style={{ background: "rgba(255,255,255,0.05)", color: T.textLo }}>↑</kbd>
                  <kbd className="px-1 py-0.5 rounded text-[8px] font-bold" style={{ background: "rgba(255,255,255,0.05)", color: T.textLo }}>↓</kbd>
                  <span className="text-[8px] ml-0.5" style={{ color: T.textLo }}>navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background: "rgba(255,255,255,0.05)", color: T.textLo }}>↵</kbd>
                  <span className="text-[8px] ml-0.5" style={{ color: T.textLo }}>select</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: T.cyan, opacity: 0.4 }} />
                <span className="text-[8px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.textLo }}>
                  {flatItems.length} result{flatItems.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
