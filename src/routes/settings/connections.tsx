import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUserStyle, setGlobalUserStyle, type UserStyle } from "@/lib/useUserStyle";
import { EliteBenefitsModal } from "@/components/EliteBenefitsModal";
import { getTwinSessionId } from "@/lib/twinSession";

/* ── Provider Config ── */
interface ProviderConfig {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  glow: string;
  biometricPoints: number;
  dataTypes: string[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: "apple_health",
    name: "Apple Health",
    subtitle: "iOS HealthKit",
    color: "#FF2D55",
    glow: "rgba(255,45,85,0.3)",
    biometricPoints: 52,
    dataTypes: ["Heart Rate", "HRV", "Sleep", "Steps", "VO2 Max", "Blood Oxygen"],
  },
  {
    id: "garmin",
    name: "Garmin",
    subtitle: "Connect IQ",
    color: "#00B4D8",
    glow: "rgba(0,180,216,0.3)",
    biometricPoints: 38,
    dataTypes: ["Heart Rate", "Body Battery", "Stress", "Sleep", "Steps", "Training Load"],
  },
  {
    id: "strava",
    name: "Strava",
    subtitle: "Activity Feed",
    color: "#FC4C02",
    glow: "rgba(252,76,2,0.3)",
    biometricPoints: 24,
    dataTypes: ["Running", "Cycling", "Swimming", "Heart Rate", "Power", "Cadence"],
  },
  {
    id: "fitbit",
    name: "Fitbit",
    subtitle: "Google Health",
    color: "#00B0B9",
    glow: "rgba(0,176,185,0.3)",
    biometricPoints: 34,
    dataTypes: ["Heart Rate", "SpO2", "Sleep Score", "Steps", "Active Zone", "Stress"],
  },
];

/* ── Provider Icon SVGs ── */
function ProviderIcon({ id, size = 32, color }: { id: string; size?: number; color: string }) {
  const s = size;
  if (id === "apple_health") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill={color} />
      </svg>
    );
  }
  if (id === "garmin") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
        <path d="M12 3v9l6 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "strava") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill={color} />
        <path d="M7.778 13.828h3.065L15.387 4 9.84 13.828H7.778z" fill={color} opacity="0.6" />
      </svg>
    );
  }
  // Fitbit
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {[4, 8, 12, 16, 20].map((y, i) => (
        <circle key={i} cx="12" cy={y} r={i === 2 ? 2.5 : i === 1 || i === 3 ? 2 : 1.5} fill={color} opacity={i === 2 ? 1 : i === 1 || i === 3 ? 0.7 : 0.4} />
      ))}
    </svg>
  );
}

/* ── Sync Status Animation ── */
function SyncStatusDisplay({
  provider,
  syncState,
  ghostMode,
}: {
  provider: ProviderConfig;
  syncState: "idle" | "syncing" | "mapping" | "synced" | "disconnected";
  ghostMode: boolean;
}) {
  const [mappedPoints, setMappedPoints] = useState(0);

  useEffect(() => {
    if (syncState === "mapping") {
      const interval = setInterval(() => {
        setMappedPoints((p) => {
          if (p >= provider.biometricPoints) {
            clearInterval(interval);
            return provider.biometricPoints;
          }
          return p + 1;
        });
      }, 60);
      return () => clearInterval(interval);
    } else {
      setMappedPoints(0);
    }
  }, [syncState, provider.biometricPoints]);

  if (syncState === "idle" || syncState === "disconnected") return null;

  const color = ghostMode ? "rgba(160,160,160,0.5)" : provider.color;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div
        className="mt-3 px-3 py-2.5 rounded-lg border"
        style={{
          background: ghostMode ? "rgba(160,160,160,0.03)" : `${provider.color}08`,
          borderColor: ghostMode ? "rgba(160,160,160,0.06)" : `${provider.color}15`,
        }}
      >
        {(syncState === "syncing" || syncState === "mapping") && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: color,
                  animation: "syncPulseDot 1.5s ease-in-out infinite",
                }}
              />
              <span
                className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color }}
              >
                {syncState === "mapping"
                  ? `Mapping ${mappedPoints} of ${provider.biometricPoints} Biometric Points...`
                  : "Establishing connection..."}
              </span>
            </div>
            {syncState === "mapping" && (
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.04)" }}
              >
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${(mappedPoints / provider.biometricPoints) * 100}%` }}
                  transition={{ duration: 0.1 }}
                  style={{
                    background: ghostMode
                      ? "rgba(160,160,160,0.4)"
                      : `linear-gradient(90deg, ${provider.color}88, ${provider.color})`,
                    boxShadow: ghostMode ? "none" : `0 0 8px ${provider.glow}`,
                  }}
                />
              </div>
            )}
          </div>
        )}
        {syncState === "synced" && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(100,200,100,0.6)" : "#34D399"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span
                className="text-[10px] font-mono"
                style={{ color: ghostMode ? "rgba(100,200,100,0.6)" : "#34D399" }}
              >
                {provider.biometricPoints} biometric points mapped
              </span>
            </div>
            <span
              className="text-[9px] font-mono"
              style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)" }}
            >
              Last Synced: Just Now
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Toggle Switch ── */
function ConnectionToggle({
  connected,
  onToggle,
  color,
  ghostMode,
  disabled,
}: {
  connected: boolean;
  onToggle: () => void;
  color: string;
  ghostMode: boolean;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: connected
          ? ghostMode
            ? "rgba(160,160,160,0.3)"
            : `${color}40`
          : ghostMode
            ? "rgba(160,160,160,0.08)"
            : "rgba(255,255,255,0.06)",
        border: `1px solid ${
          connected
            ? ghostMode
              ? "rgba(160,160,160,0.4)"
              : `${color}60`
            : ghostMode
              ? "rgba(160,160,160,0.12)"
              : "rgba(255,255,255,0.08)"
        }`,
        boxShadow: connected && !ghostMode ? `0 0 12px ${color}30` : "none",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <motion.div
        animate={{ x: connected ? 24 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-5 h-5 rounded-full"
        style={{
          background: connected
            ? ghostMode
              ? "rgba(220,220,220,0.8)"
              : color
            : ghostMode
              ? "rgba(160,160,160,0.4)"
              : "rgba(255,255,255,0.2)",
          boxShadow: connected && !ghostMode ? `0 0 8px ${color}50` : "none",
        }}
      />
    </button>
  );
}

/* ── Provider Card ── */
function ProviderCard({
  provider,
  connected,
  syncState,
  onToggle,
  ghostMode,
  disabled,
}: {
  provider: ProviderConfig;
  connected: boolean;
  syncState: "idle" | "syncing" | "mapping" | "synced" | "disconnected";
  onToggle: () => void;
  ghostMode: boolean;
  disabled: boolean;
}) {
  const color = ghostMode ? "rgba(160,160,160,0.5)" : provider.color;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        background: ghostMode
          ? "rgba(160,160,160,0.02)"
          : connected
            ? `linear-gradient(135deg, ${provider.color}06 0%, rgba(255,255,255,0.01) 100%)`
            : "rgba(255,255,255,0.015)",
        borderColor: ghostMode
          ? "rgba(160,160,160,0.06)"
          : connected
            ? `${provider.color}20`
            : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        boxShadow: connected && !ghostMode
          ? `0 0 20px ${provider.color}08, inset 0 1px 0 ${provider.color}10`
          : "inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* Icon container */}
            <div
              className="relative w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: ghostMode
                  ? "rgba(160,160,160,0.06)"
                  : connected
                    ? `${provider.color}12`
                    : "rgba(255,255,255,0.03)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : connected ? `${provider.color}20` : "rgba(255,255,255,0.04)"}`,
                boxShadow: connected && !ghostMode ? `0 0 16px ${provider.color}15` : "none",
              }}
            >
              <ProviderIcon id={provider.id} size={24} color={color} />
              {/* Connected indicator dot */}
              {connected && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
                  style={{
                    background: ghostMode ? "rgba(100,200,100,0.6)" : "#34D399",
                    borderColor: ghostMode ? "#0a0a0a" : "#030303",
                    boxShadow: ghostMode ? "none" : "0 0 6px rgba(52,211,153,0.5)",
                  }}
                />
              )}
            </div>

            {/* Name + subtitle */}
            <div className="flex flex-col gap-0.5">
              <span
                className="text-sm font-semibold tracking-wide"
                style={{
                  color: ghostMode
                    ? "rgba(220,220,220,0.8)"
                    : connected
                      ? "rgba(255,255,255,0.95)"
                      : "rgba(255,255,255,0.6)",
                }}
              >
                {provider.name}
              </span>
              <span
                className="text-[10px] font-mono uppercase tracking-wider"
                style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)" }}
              >
                {provider.subtitle}
              </span>
            </div>
          </div>

          {/* Coming later — wearables not live */}
          {disabled ? (
            <span
              className="px-2.5 py-1 rounded-full text-[8px] font-mono uppercase tracking-wider flex-shrink-0"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,184,107,0.08)",
                color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(255,184,107,0.8)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : "rgba(255,184,107,0.2)"}`,
              }}
            >
              Coming later
            </span>
          ) : (
            <ConnectionToggle
              connected={connected}
              onToggle={onToggle}
              color={provider.color}
              ghostMode={ghostMode}
              disabled={disabled}
            />
          )}
        </div>

        {/* Data types chips */}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {provider.dataTypes.map((dt) => (
            <span
              key={dt}
              className="px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wider"
              style={{
                background: ghostMode
                  ? "rgba(160,160,160,0.04)"
                  : connected
                    ? `${provider.color}08`
                    : "rgba(255,255,255,0.02)",
                color: ghostMode
                  ? "rgba(160,160,160,0.3)"
                  : connected
                    ? `${provider.color}90`
                    : "rgba(255,255,255,0.2)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : connected ? `${provider.color}15` : "rgba(255,255,255,0.03)"}`,
              }}
            >
              {dt}
            </span>
          ))}
        </div>

        {/* Sync status */}
        <AnimatePresence>
          <SyncStatusDisplay
            provider={provider}
            syncState={syncState}
            ghostMode={ghostMode}
          />
        </AnimatePresence>
      </div>
    </motion.div>
  );
}


/* ── Manual Vitals Panel (persists via quickLog under twin sessionId) ── */
const MANUAL_VITALS = [
  { key: "hr", label: "Heart Rate", unit: "bpm", min: 40, max: 200, step: 1, default: 68 },
  { key: "hrv", label: "HRV", unit: "ms", min: 10, max: 200, step: 1, default: 55 },
  { key: "sleep_hours", label: "Sleep", unit: "hrs", min: 0, max: 14, step: 0.5, default: 7.5 },
  { key: "steps", label: "Steps", unit: "steps", min: 0, max: 50000, step: 100, default: 5000 },
] as const;

function ManualVitalsPanel({
  sessionId,
  ghostMode,
  neon,
}: {
  sessionId: string;
  ghostMode: boolean;
  neon: string;
}) {
  const logVital = useMutation(api.quickLog.logVital);
  const latest = useQuery(api.quickLog.getLatestVitals, sessionId ? { sessionId } : "skip");
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const v of MANUAL_VITALS) init[v.key] = v.default;
    return init;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!latest) return;
    setValues((prev) => ({
      ...prev,
      hr: latest.hr?.value ?? prev.hr,
      hrv: latest.hrv?.value ?? prev.hrv,
      sleep_hours: latest.sleepHours?.value ?? prev.sleep_hours,
      steps: latest.steps?.value ?? prev.steps,
    }));
  }, [latest]);

  const saveOne = useCallback(
    async (vital: (typeof MANUAL_VITALS)[number]) => {
      setSaving(vital.key);
      try {
        await logVital({
          sessionId,
          vitalType: vital.key,
          value: values[vital.key],
          unit: vital.unit,
        });
        setSaved((p) => ({ ...p, [vital.key]: true }));
      } catch {
        /* ignore */
      } finally {
        setSaving(null);
      }
    },
    [logVital, sessionId, values]
  );

  const saveAll = useCallback(async () => {
    setBatchSaving(true);
    setBatchMsg(null);
    try {
      for (const vital of MANUAL_VITALS) {
        await logVital({
          sessionId,
          vitalType: vital.key,
          value: values[vital.key],
          unit: vital.unit,
        });
        setSaved((p) => ({ ...p, [vital.key]: true }));
      }
      setBatchMsg("Saved to twin — dashboard & brief will update");
    } catch {
      setBatchMsg("Save failed — try again");
    } finally {
      setBatchSaving(false);
    }
  }, [logVital, sessionId, values]);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: ghostMode
          ? "rgba(160,160,160,0.02)"
          : "linear-gradient(135deg, rgba(0,255,204,0.05) 0%, rgba(255,255,255,0.01) 100%)",
        borderColor: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.15)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2
              className="text-sm font-semibold tracking-wide"
              style={{ color: ghostMode ? "rgba(220,220,220,0.85)" : "rgba(255,255,255,0.95)" }}
            >
              Manual Vitals
            </h2>
            <p
              className="text-[10px] font-mono uppercase tracking-wider mt-0.5"
              style={{ color: `${neon}0.45)` }}
            >
              Feeds twin · dashboard · brief
            </p>
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wider"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.08)",
              color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(0,255,204,0.7)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : "rgba(0,255,204,0.2)"}`,
            }}
          >
            Available now
          </span>
        </div>

        <div className="flex flex-col gap-2.5 mt-4">
          {MANUAL_VITALS.map((vital) => (
            <div
              key={vital.key}
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl"
              style={{
                background: saved[vital.key] ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${saved[vital.key] ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.05)"}`,
              }}
            >
              <div className="min-w-[72px]">
                <div className="text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {vital.label}
                </div>
                <div className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {vital.unit}
                </div>
              </div>
              <input
                type="number"
                value={values[vital.key]}
                min={vital.min}
                max={vital.max}
                step={vital.step}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setValues((p) => ({ ...p, [vital.key]: n }));
                  setSaved((p) => ({ ...p, [vital.key]: false }));
                }}
                className="w-24 px-2 py-1.5 rounded-lg text-right text-sm font-mono tabular-nums outline-none"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.9)",
                }}
              />
              <button
                type="button"
                onClick={() => saveOne(vital)}
                disabled={saving === vital.key}
                className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider min-w-[52px]"
                style={{
                  background: saved[vital.key] ? "rgba(52,211,153,0.12)" : "rgba(0,255,204,0.1)",
                  border: `1px solid ${saved[vital.key] ? "rgba(52,211,153,0.3)" : "rgba(0,255,204,0.25)"}`,
                  color: saved[vital.key] ? "#34D399" : "#00FFCC",
                  opacity: saving === vital.key ? 0.6 : 1,
                }}
              >
                {saving === vital.key ? "…" : saved[vital.key] ? "✓" : "Save"}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={saveAll}
          disabled={batchSaving}
          className="w-full mt-4 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-wider transition-all"
          style={{
            background: ghostMode
              ? "rgba(160,160,160,0.08)"
              : "linear-gradient(135deg, rgba(0,255,204,0.15), rgba(0,255,204,0.05))",
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(0,255,204,0.3)"}`,
            color: ghostMode ? "rgba(220,220,220,0.7)" : "#00FFCC",
            opacity: batchSaving ? 0.6 : 1,
          }}
        >
          {batchSaving ? "Saving…" : "Save all manual vitals"}
        </button>
        {batchMsg && (
          <p className="mt-2 text-[10px] font-mono text-center" style={{ color: "rgba(52,211,153,0.8)" }}>
            {batchMsg}
          </p>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   ConnectionsPage — Main Export
   ══════════════════════════════════════════════ */
function ConnectionsPage() {
  const ghostMode = useGhostMode();
  const userStyle = useUserStyle();
  const neon = ghostMode ? "rgba(160,160,160," : "rgba(0,255,204,";
  const upsertPreference = useMutation(api.mutations.upsertUserPreference);
  const updateTier = useMutation(api.mutations.updateMembershipTier);
  const [showEliteModal, setShowEliteModal] = useState(false);
  const [tierTransition, setTierTransition] = useState(false);

  const sessionId = useMemo(() => getTwinSessionId(), []);

  // Convex data
  // Wearable integrationConnections are display-only until OAuth ships
  useQuery(api.queries.getIntegrationConnections, { sessionId });

  // Wearable OAuth is not live yet — never claim connected / synced
  const handleToggle = useCallback((_provider: ProviderConfig) => {
    // no-op: coming later
  }, []);

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: ghostMode
          ? "linear-gradient(180deg, #080808 0%, #0a0a0a 50%, #080808 100%)"
          : "linear-gradient(180deg, #030303 0%, #050505 50%, #030303 100%)",
      }}
    >
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.08)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.15)"}`,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? "rgba(160,160,160,0.5)" : "#00FFCC"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div>
            <h1
              className="text-xl font-semibold tracking-wide"
              style={{ color: ghostMode ? "rgba(220,220,220,0.85)" : "rgba(255,255,255,0.95)" }}
            >
              Connections
            </h1>
            <p
              className="text-[10px] font-mono uppercase tracking-[0.15em]"
              style={{ color: `${neon}0.4)` }}
            >
              Integration Hub
            </p>
          </div>
        </div>
      </div>

      {/* Active Syncs Summary */}
      <div className="px-6 pb-4">
        <div
          className="flex items-center justify-between px-5 py-3.5 rounded-xl border"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.02)" : "rgba(0,255,204,0.03)",
            borderColor: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,255,204,0.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: ghostMode ? "rgba(160,160,160,0.2)" : "rgba(255,184,107,0.55)" }}
                />
              <span
                className="text-xs font-mono font-semibold"
                style={{ color: ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.8)" }}
              >
                Wearable sync coming later
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-mono tabular-nums"
              style={{ color: `${neon}0.4)` }}
            >
              Use Manual Vitals below
            </span>
          </div>
        </div>
      </div>


      {/* Manual Vitals — Brad-usable path until wearables are real */}
      <div className="px-6 pb-4">
        <ManualVitalsPanel sessionId={sessionId} ghostMode={ghostMode} neon={neon} />
      </div>

      {/* Honesty banner */}
      <div className="px-6 pb-3">
        <div
          className="px-4 py-3 rounded-xl text-[10px] font-mono leading-relaxed"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,184,107,0.05)",
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,184,107,0.15)"}`,
            color: ghostMode ? "rgba(220,220,220,0.55)" : "rgba(255,184,107,0.75)",
          }}
        >
          Apple Health, Garmin, Strava, and Fitbit are listed for upcoming OAuth — they are not live. Use Manual Vitals (above) to feed your twin and dashboard now.
        </div>
      </div>

      {/* Provider Grid */}
      <div className="px-6 pb-8 flex flex-col gap-3">
        {PROVIDERS.map((provider, i) => (
          <motion.div
            key={provider.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <ProviderCard
              provider={provider}
              connected={false}
              syncState={"idle"}
              onToggle={() => handleToggle(provider)}
              ghostMode={ghostMode}
              disabled={true}
            />
          </motion.div>
        ))}
      </div>

      {/* ── Level Up Toggle ── */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-mono uppercase tracking-[0.15em] font-semibold"
            style={{ color: `${neon}0.5)` }}
          >
            Experience Mode
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: `linear-gradient(90deg, ${neon}0.1), transparent)` }}
          />
        </div>

        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.02)'
              : userStyle === 'elite'
                ? 'linear-gradient(135deg, rgba(0,240,255,0.04) 0%, rgba(255,255,255,0.01) 100%)'
                : 'rgba(255,255,255,0.015)',
            borderColor: ghostMode
              ? 'rgba(160,160,160,0.06)'
              : userStyle === 'elite'
                ? 'rgba(0,240,255,0.15)'
                : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: ghostMode
                      ? 'rgba(160,160,160,0.06)'
                      : userStyle === 'elite'
                        ? 'rgba(0,240,255,0.1)'
                        : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : userStyle === 'elite' ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                    boxShadow: userStyle === 'elite' && !ghostMode ? '0 0 16px rgba(0,240,255,0.12)' : 'none',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={ghostMode ? 'rgba(160,160,160,0.4)' : userStyle === 'elite' ? '#00F0FF' : 'rgba(255,255,255,0.3)'} />
                  </svg>
                  {userStyle === 'elite' && !ghostMode && (
                    <div
                      className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2"
                      style={{
                        background: '#00F0FF',
                        borderColor: '#030303',
                        boxShadow: '0 0 6px rgba(0,240,255,0.5)',
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span
                    className="text-sm font-semibold tracking-wide"
                    style={{
                      color: ghostMode
                        ? 'rgba(220,220,220,0.8)'
                        : 'rgba(255,255,255,0.95)',
                    }}
                  >
                    {userStyle === 'elite' ? 'Elite Mode' : 'Core Mode'}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}
                  >
                    {userStyle === 'elite'
                      ? 'Full biometric data & advanced trends'
                      : 'Simple insights & daily guidance'}
                  </span>
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => {
                  const newStyle: UserStyle = userStyle === 'elite' ? 'core' : 'elite';
                  setGlobalUserStyle(newStyle);
                  upsertPreference({ sessionId, userStyle: newStyle });
                }}
                className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
                style={{
                  background: userStyle === 'elite'
                    ? ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(0,240,255,0.3)'
                    : ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${userStyle === 'elite'
                    ? ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(0,240,255,0.5)'
                    : ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(255,255,255,0.08)'
                  }`,
                  boxShadow: userStyle === 'elite' && !ghostMode ? '0 0 12px rgba(0,240,255,0.2)' : 'none',
                }}
              >
                <motion.div
                  animate={{ x: userStyle === 'elite' ? 24 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-[2px] w-5 h-5 rounded-full"
                  style={{
                    background: userStyle === 'elite'
                      ? ghostMode ? 'rgba(220,220,220,0.8)' : '#00F0FF'
                      : ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.2)',
                    boxShadow: userStyle === 'elite' && !ghostMode ? '0 0 8px rgba(0,240,255,0.4)' : 'none',
                  }}
                />
              </button>
            </div>

            {/* Description */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(userStyle === 'elite'
                ? ['Bio-Vault Access', 'Raw Lab Data', 'Advanced Trends', 'GATT Charts', 'Genetic Insights']
                : ['Simple Insights', 'Voice Logging', 'Daily Guidance', 'Health Summary']
              ).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[8px] font-mono uppercase tracking-wider"
                  style={{
                    background: ghostMode
                      ? 'rgba(160,160,160,0.04)'
                      : userStyle === 'elite'
                        ? 'rgba(0,240,255,0.06)'
                        : 'rgba(255,255,255,0.02)',
                    color: ghostMode
                      ? 'rgba(160,160,160,0.3)'
                      : userStyle === 'elite'
                        ? 'rgba(0,240,255,0.6)'
                        : 'rgba(255,255,255,0.2)',
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : userStyle === 'elite' ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.03)'}`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Account Tier Section ── */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-mono uppercase tracking-[0.15em] font-semibold"
            style={{ color: `${neon}0.5)` }}
          >
            Account Tier
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: `linear-gradient(90deg, ${neon}0.1), transparent)` }}
          />
        </div>

        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.02)'
              : userStyle === 'elite'
                ? 'linear-gradient(135deg, rgba(0,240,255,0.04) 0%, rgba(167,139,250,0.02) 100%)'
                : 'rgba(255,255,255,0.015)',
            borderColor: ghostMode
              ? 'rgba(160,160,160,0.06)'
              : userStyle === 'elite'
                ? 'rgba(0,240,255,0.15)'
                : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            boxShadow: userStyle === 'elite' && !ghostMode
              ? '0 0 30px rgba(0,240,255,0.06), inset 0 1px 0 rgba(0,240,255,0.08)'
              : 'inset 0 1px 0 rgba(255,255,255,0.02)',
          }}
        >
          <div className="p-5">
            {/* Tier Badge + Info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3.5">
                <div
                  className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: ghostMode
                      ? 'rgba(160,160,160,0.06)'
                      : userStyle === 'elite'
                        ? 'rgba(0,240,255,0.1)'
                        : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : userStyle === 'elite' ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
                    boxShadow: userStyle === 'elite' && !ghostMode ? '0 0 20px rgba(0,240,255,0.12)' : 'none',
                  }}
                >
                  {userStyle === 'elite' ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={ghostMode ? 'rgba(160,160,160,0.4)' : '#00F0FF'} />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {tierTransition && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      onAnimationComplete={() => setTierTransition(false)}
                      className="absolute inset-0 rounded-xl"
                      style={{
                        border: `2px solid ${userStyle === 'elite' ? '#00F0FF' : 'rgba(255,255,255,0.2)'}`,
                      }}
                    />
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-semibold tracking-wide"
                      style={{ color: ghostMode ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.95)' }}
                    >
                      {userStyle === 'elite' ? 'Elite' : 'Core'} Membership
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider"
                      style={{
                        background: userStyle === 'elite'
                          ? (ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,240,255,0.1)')
                          : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'),
                        color: userStyle === 'elite'
                          ? (ghostMode ? 'rgba(160,160,160,0.5)' : '#00F0FF')
                          : (ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.3)'),
                        border: `1px solid ${userStyle === 'elite'
                          ? (ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(0,240,255,0.2)')
                          : (ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.06)')
                        }`,
                      }}
                    >
                      {userStyle === 'elite' ? 'Active' : 'Free'}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}
                  >
                    {userStyle === 'elite'
                      ? 'Full access to all features'
                      : 'Basic insights & daily guidance'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Change Tier Button */}
              <button
                onClick={() => {
                  const newTier: UserStyle = userStyle === 'elite' ? 'core' : 'elite';
                  setGlobalUserStyle(newTier);
                  setTierTransition(true);
                  updateTier({ sessionId, membershipTier: newTier });
                  upsertPreference({ sessionId, userStyle: newTier });
                }}
                className="flex-1 py-2.5 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all duration-300"
                style={{
                  background: ghostMode
                    ? 'rgba(160,160,160,0.06)'
                    : userStyle === 'elite'
                      ? 'rgba(255,255,255,0.03)'
                      : 'linear-gradient(135deg, rgba(0,240,255,0.12) 0%, rgba(0,240,255,0.04) 100%)',
                  color: ghostMode
                    ? 'rgba(160,160,160,0.5)'
                    : userStyle === 'elite'
                      ? 'rgba(255,255,255,0.5)'
                      : '#00F0FF',
                  border: `1px solid ${ghostMode
                    ? 'rgba(160,160,160,0.1)'
                    : userStyle === 'elite'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,240,255,0.2)'
                  }`,
                  boxShadow: userStyle !== 'elite' && !ghostMode ? '0 0 16px rgba(0,240,255,0.08)' : 'none',
                }}
              >
                {userStyle === 'elite' ? 'Switch to Core' : '⬆ Upgrade to Elite'}
              </button>

              {/* View Benefits Button */}
              <button
                onClick={() => setShowEliteModal(true)}
                className="py-2.5 px-4 rounded-xl text-[10px] font-mono uppercase tracking-wider transition-all duration-300"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.02)',
                  color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.04)'}`,
                }}
              >
                View Benefits
              </button>
            </div>

            {/* Core user upsell hint */}
            {userStyle === 'core' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.02)' : 'rgba(0,240,255,0.03)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(0,240,255,0.06)'}`,
                }}
              >
                <span className="text-[10px]" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(0,240,255,0.5)' }}>✦</span>
                <span
                  className="text-[10px] leading-relaxed"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}
                >
                  Elite unlocks Advanced Bio-Analytics, InsightBridge AI, Genetic Insights, and Priority Support.
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Elite Benefits Modal */}
      <EliteBenefitsModal
        isOpen={showEliteModal}
        onClose={() => setShowEliteModal(false)}
        onUpgrade={() => {
          const newTier: UserStyle = 'elite';
          setGlobalUserStyle(newTier);
          setTierTransition(true);
          updateTier({ sessionId, membershipTier: newTier });
          upsertPreference({ sessionId, userStyle: newTier });
        }}
        currentTier={userStyle as 'core' | 'elite'}
        ghostMode={ghostMode}
      />

      {/* Sync Status Section */}
      <div className="px-6 pb-12">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-mono uppercase tracking-[0.15em] font-semibold"
            style={{ color: `${neon}0.5)` }}
          >
            Sync Status
          </span>
          <div
            className="flex-1 h-px"
            style={{ background: `linear-gradient(90deg, ${neon}0.1), transparent)` }}
          />
        </div>

        <div className="flex flex-col gap-2">
          {PROVIDERS.map((provider) => {
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl border"
                style={{
                  background: ghostMode ? "rgba(160,160,160,0.015)" : "rgba(255,255,255,0.01)",
                  borderColor: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,255,255,0.03)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <ProviderIcon id={provider.id} size={16} color={ghostMode ? "rgba(160,160,160,0.2)" : "rgba(255,255,255,0.15)"} />
                  <span
                    className="text-xs font-medium"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)" }}
                  >
                    {provider.name}
                  </span>
                </div>
                <span
                  className="text-[9px] font-mono uppercase tracking-wider"
                  style={{ color: ghostMode ? "rgba(160,160,160,0.2)" : "rgba(255,184,107,0.55)" }}
                >
                  Coming later
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes syncPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

export const Route = createFileRoute("/settings/connections")({
  component: ConnectionsPage,
});
