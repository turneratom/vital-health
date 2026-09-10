import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ══════════════════════════════════════════════════════════════ */
/* ── Warm Earth-Tone Palette (matches VitalsView) ──           */
/* ══════════════════════════════════════════════════════════════ */
const W = {
  terra: "#E8976C",
  sage: "#7CB68E",
  sky: "#6BA3BE",
  gold: "#C4A46C",
  rose: "#D4847A",
  sand: "#E8E0D8",
  cardBg: "rgba(26,24,22,0.7)",
  cardBorder: "rgba(42,38,34,0.6)",
  textPrimary: "#E8E0D8",
  textSecondary: "#B0A89E",
  textDim: "#8A7E72",
};

/* ══════════════════════════════════════════════════════════════ */
/* ── Calorie-Driven BioFigure with Mesh Scale Animation ──     */
/* ══════════════════════════════════════════════════════════════ */
function TransformBioFigure({
  calorieRatio,
  ghostMode,
}: {
  /** 0–1 where 0 = max deficit (slimmest), 1 = baseline/surplus */
  calorieRatio: number;
  ghostMode: boolean;
}) {
  // Scale torso width based on calorie ratio: deficit = slimmer
  // Range: 0.82 (very slim) to 1.0 (baseline)
  const bodyScale = 0.82 + calorieRatio * 0.18;
  const limbScale = 0.88 + calorieRatio * 0.12;

  const meshStroke = ghostMode ? "rgba(160,160,160,0.08)" : `${W.terra}18`;
  const glowColor = ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}15`;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="280" viewBox="0 0 140 340" className="block">
        <defs>
          <linearGradient id="bodyMeshGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ghostMode ? "rgba(160,160,160,0.08)" : `${W.terra}12`} />
            <stop offset="50%" stopColor={ghostMode ? "rgba(160,160,160,0.04)" : `${W.sage}08`} />
            <stop offset="100%" stopColor={ghostMode ? "rgba(160,160,160,0.02)" : `${W.sky}06`} />
          </linearGradient>
          <filter id="meshGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
          {/* Animated scan line */}
          <linearGradient id="scanLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="45%" stopColor="transparent" />
            <stop offset="50%" stopColor={ghostMode ? "rgba(160,160,160,0.15)" : `${W.terra}35`} />
            <stop offset="55%" stopColor="transparent" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Ambient glow behind figure */}
        {!ghostMode && (
          <ellipse
            cx={70} cy={170} rx={50 * bodyScale} ry={120}
            fill={glowColor} filter="url(#meshGlow)"
          />
        )}

        {/* ── Head ── */}
        <ellipse cx={70} cy={38} rx={13} ry={16}
          fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.8}
          style={{ transition: "all 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />

        {/* ── Neck ── */}
        <rect x={64} y={54} width={12} height={12} rx={3}
          fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.4}
        />

        {/* ── Torso (scales with calorie ratio) ── */}
        <g style={{ transition: "transform 1.2s cubic-bezier(0.4,0,0.2,1)" }}
           transform={`translate(70, 120) scale(${bodyScale}, 1) translate(-70, -120)`}>
          {/* Shoulders + chest */}
          <path
            d={`M 46,68 C 42,64 38,64 36,70 L 34,86 C 36,92 42,96 50,98 L 70,100 L 90,98 C 98,96 104,92 106,86 L 104,70 C 102,64 98,64 94,68 Z`}
            fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.6}
          />
          {/* Abdomen */}
          <path
            d={`M 50,98 C 48,110 46,126 48,142 L 56,148 L 70,150 L 84,148 L 92,142 C 94,126 92,110 90,98 Z`}
            fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.5}
          />
          {/* Mesh grid lines on torso */}
          {[80, 95, 110, 125, 140].map((y) => (
            <line key={y} x1={48} y1={y} x2={92} y2={y}
              stroke={meshStroke} strokeWidth={0.3} strokeDasharray="2 3" opacity={0.5}
            />
          ))}
          {[55, 62, 70, 78, 85].map((x) => (
            <line key={x} x1={x} y1={70} x2={x} y2={148}
              stroke={meshStroke} strokeWidth={0.3} strokeDasharray="2 3" opacity={0.4}
            />
          ))}
          {/* Hips */}
          <path
            d={`M 48,142 C 44,152 42,164 44,174 L 56,180 L 70,182 L 84,180 L 96,174 C 98,164 96,152 92,142 Z`}
            fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.5}
          />
        </g>

        {/* ── Arms (scale with limb ratio) ── */}
        <g style={{ transition: "transform 1.2s cubic-bezier(0.4,0,0.2,1)" }}
           transform={`translate(28, 100) scale(${limbScale}, 1) translate(-28, -100)`}>
          {/* Left arm */}
          <path d="M 36,70 C 30,82 26,100 24,120 C 22,136 22,152 24,164"
            fill="none" stroke={meshStroke} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={24} cy={168} rx={4} ry={5} fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.3} />
        </g>
        <g style={{ transition: "transform 1.2s cubic-bezier(0.4,0,0.2,1)" }}
           transform={`translate(112, 100) scale(${limbScale}, 1) translate(-112, -100)`}>
          {/* Right arm */}
          <path d="M 104,70 C 110,82 114,100 116,120 C 118,136 118,152 116,164"
            fill="none" stroke={meshStroke} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={116} cy={168} rx={4} ry={5} fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.3} />
        </g>

        {/* ── Legs ── */}
        <g style={{ transition: "transform 1.2s cubic-bezier(0.4,0,0.2,1)" }}
           transform={`translate(56, 240) scale(${limbScale}, 1) translate(-56, -240)`}>
          <path d="M 56,180 C 52,200 48,228 48,256 C 48,276 48,296 50,310"
            fill="none" stroke={meshStroke} strokeWidth={3.5} strokeLinecap="round" />
          <ellipse cx={50} cy={316} rx={7} ry={4} fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.3} />
        </g>
        <g style={{ transition: "transform 1.2s cubic-bezier(0.4,0,0.2,1)" }}
           transform={`translate(84, 240) scale(${limbScale}, 1) translate(-84, -240)`}>
          <path d="M 84,180 C 88,200 92,228 92,256 C 92,276 92,296 90,310"
            fill="none" stroke={meshStroke} strokeWidth={3.5} strokeLinecap="round" />
          <ellipse cx={90} cy={316} rx={7} ry={4} fill="url(#bodyMeshGrad)" stroke={meshStroke} strokeWidth={0.3} />
        </g>

        {/* Animated scan line sweeping down the figure */}
        {!ghostMode && (
          <rect x={20} y={0} width={100} height={340} fill="url(#scanLine)" opacity={0.4}>
            <animateTransform
              attributeName="transform" type="translate"
              values="0 -340; 0 340" dur="4s" repeatCount="indefinite"
            />
          </rect>
        )}

        {/* Center line */}
        <line x1={70} y1={54} x2={70} y2={180}
          stroke={ghostMode ? "rgba(160,160,160,0.04)" : `${W.terra}08`}
          strokeWidth={0.5} strokeDasharray="3 4"
        />

        {/* Measurement markers */}
        {!ghostMode && (
          <>
            {/* Waist marker */}
            <line x1={38} y1={125} x2={102} y2={125}
              stroke={`${W.terra}25`} strokeWidth={0.5} strokeDasharray="2 2" />
            <circle cx={38} cy={125} r={2} fill={`${W.terra}40`} />
            <circle cx={102} cy={125} r={2} fill={`${W.terra}40`} />
          </>
        )}
      </svg>

      {/* On track to lose weight label */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="flex items-center gap-2 mt-1"
      >
        <div className="w-1.5 h-1.5 rounded-full" style={{
          background: ghostMode ? "rgba(160,160,160,0.3)" : W.sage,
          boxShadow: ghostMode ? "none" : `0 0 6px ${W.sage}60`,
        }} />
        <span className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : W.sage }}>
          On track to lose weight
        </span>
      </motion.div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Photo Comparison Panel ──                                 */
/* ══════════════════════════════════════════════════════════════ */
function PhotoPanel({
  photo,
  label,
  sublabel,
  isProjected,
  ghostMode,
}: {
  photo: string | null;
  label: string;
  sublabel: string;
  isProjected?: boolean;
  ghostMode: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center gap-2">
      <div
        className="relative w-full aspect-[3/4] rounded-xl overflow-hidden"
        style={{
          background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(20,18,16,0.6)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : isProjected ? `${W.sage}25` : `${W.terra}20`}`,
        }}
      >
        {photo ? (
          <>
            <img
              src={photo}
              alt={label}
              className="w-full h-full object-cover"
              style={{
                filter: isProjected ? "brightness(1.05) contrast(1.08) saturate(1.1)" : "none",
              }}
            />
            {/* Projection overlay effect */}
            {isProjected && !ghostMode && (
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(180deg, transparent 30%, ${W.sage}08 60%, ${W.sage}15 100%)`,
                  mixBlendMode: "screen",
                }}
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
            <span style={{ fontSize: 28, opacity: ghostMode ? 0.3 : 0.5 }}>
              {isProjected ? "\uD83D\uDD2E" : "\uD83D\uDCF8"}
            </span>
            <span className="text-[10px] text-center leading-tight"
              style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : W.textDim }}>
              {isProjected ? "Upload your photo to see what's possible" : "No photo yet"}
            </span>
          </div>
        )}

        {/* Label badge */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          <span
            className="text-[8px] font-bold tracking-widest uppercase px-2 py-1 rounded-md"
            style={{
              background: ghostMode ? "rgba(30,30,30,0.8)" : "rgba(15,14,13,0.85)",
              color: ghostMode ? "rgba(160,160,160,0.5)" : isProjected ? W.sage : W.terra,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : isProjected ? `${W.sage}30` : `${W.terra}25`}`,
              backdropFilter: "blur(8px)",
            }}
          >
            {label}
          </span>
          {isProjected && photo && (
            <span
              className="text-[7px] font-bold tracking-wider px-1.5 py-0.5 rounded-md"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.sage}12`,
                color: ghostMode ? "rgba(160,160,160,0.4)" : W.sage,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.sage}25`}`,
              }}
            >
              PROJECTED
            </span>
          )}
        </div>
      </div>
      <span className="text-[9px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : W.textDim }}>
        {sublabel}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Projected Stats Row ──                                    */
/* ══════════════════════════════════════════════════════════════ */
function ProjectedStats({ ghostMode, hasPhoto }: { ghostMode: boolean; hasPhoto: boolean }) {
  const stats = [
    { label: "Body Fat", current: "18%", projected: "14%", delta: "-4%", good: true },
    { label: "Lean Mass", current: "156 lbs", projected: "162 lbs", delta: "+6 lbs", good: true },
    { label: "Waist", current: '34"', projected: '31"', delta: '-3"', good: true },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center py-2 px-1 rounded-lg"
          style={{
            background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(26,24,22,0.5)",
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(42,38,34,0.4)"}`,
            opacity: hasPhoto ? 1 : 0.5,
          }}
        >
          <span className="text-[9px] font-medium mb-1"
            style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim }}>
            {s.label}
          </span>
          <span className="text-sm font-semibold tabular-nums"
            style={{ color: ghostMode ? "rgba(160,160,160,0.6)" : W.textPrimary }}>
            {hasPhoto ? s.projected : s.current}
          </span>
          {hasPhoto && (
            <span className="text-[10px] font-bold tabular-nums mt-0.5"
              style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : s.good ? W.sage : W.rose }}>
              {s.delta}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN COMPONENT — PhysicalBaselineCapture ──               */
/* ══════════════════════════════════════════════════════════════ */
export interface PhysicalBaselineCaptureProps {
  ghostMode: boolean;
  /** 0–1 calorie deficit ratio for BioFigure animation */
  calorieRatio: number;
}

export function PhysicalBaselineCapture({ ghostMode, calorieRatio }: PhysicalBaselineCaptureProps) {
  const [baselinePhoto, setBaselinePhoto] = useState<string | null>(null);
  const [projectedPhoto, setProjectedPhoto] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setBaselinePhoto(dataUrl);
      setProjectedPhoto(null);
      setIsScanning(true);
      setScanProgress(0);
    };
    reader.readAsDataURL(file);
  }, []);

  // Simulate scan + projection generation
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setProjectedPhoto(baselinePhoto);
          return 100;
        }
        return p + 2;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [isScanning, baselinePhoto]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="mx-5 mb-5 rounded-2xl overflow-hidden"
      style={{
        background: ghostMode ? "rgba(12,12,12,0.5)" : W.cardBg,
        backdropFilter: "blur(24px)",
        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : W.cardBorder}`,
        boxShadow: ghostMode ? "none" : `0 8px 32px rgba(0,0,0,0.3), 0 0 60px ${W.terra}06`,
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}12`,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.terra}20`}`,
            }}>
            <span style={{ fontSize: 16 }}>\uD83E\uDE9E</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : W.textPrimary }}>
              My Body Change
            </h3>
            <p className="text-[10px]" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim }}>
              See how you'll look in 90 days
            </p>
          </div>
        </div>
        {baselinePhoto && (
          <span className="text-[8px] font-bold tracking-wider px-2 py-1 rounded-full"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.sage}10`,
              color: ghostMode ? "rgba(160,160,160,0.4)" : W.sage,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.sage}20`}`,
            }}>
            STARTING POINT SET
          </span>
        )}
      </div>

      {/* Capture Button (when no photo) */}
      {!baselinePhoto && (
        <div className="px-4 pb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="w-full py-8 rounded-xl flex flex-col items-center gap-3 cursor-pointer transition-all duration-300"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.03)" : `linear-gradient(135deg, ${W.terra}08, ${W.gold}06)`,
              border: `2px dashed ${ghostMode ? "rgba(160,160,160,0.12)" : `${W.terra}25`}`,
            }}
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}10`,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : `${W.terra}20`}`,
              }}>
              <span style={{ fontSize: 28 }}>\uD83D\uDCF8</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-semibold"
                style={{ color: ghostMode ? "rgba(200,200,200,0.6)" : W.terra }}>
                Take my &quot;Before&quot; Photo
              </span>
              <span className="text-[11px]"
                style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : W.textDim }}>
                Upload or snap a full-body photo to get started
              </span>
            </div>
          </motion.button>
        </div>
      )}

      {/* Scanning Progress */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3"
          >
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 rounded-full border-2 border-t-transparent"
                style={{ borderColor: `${W.terra}60`, borderTopColor: "transparent" }}
              />
              <span className="text-xs font-medium" style={{ color: W.terra }}>
                Creating your 90-day preview...
              </span>
              <span className="text-xs font-bold tabular-nums ml-auto" style={{ color: W.terra }}>
                {scanProgress}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}10` }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${scanProgress}%`,
                  background: `linear-gradient(90deg, ${W.terra}, ${W.sage})`,
                  boxShadow: `0 0 8px ${W.terra}40`,
                  transition: "width 0.1s linear",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side-by-Side Photo Comparison */}
      {baselinePhoto && !isScanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="px-4 pb-3"
        >
          <div className="flex gap-3 mb-3">
            <PhotoPanel
              photo={baselinePhoto}
              label="MY STARTING POINT"
              sublabel="Where I am today"
              ghostMode={ghostMode}
            />
            <PhotoPanel
              photo={projectedPhoto}
              label="IN 3 MONTHS"
              sublabel="What I'll look like"
              isProjected
              ghostMode={ghostMode}
            />
          </div>

          {/* Projected stats */}
          <ProjectedStats ghostMode={ghostMode} hasPhoto={!!projectedPhoto} />

          {/* Retake button */}
          <div className="flex justify-center mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim,
                background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(232,224,216,0.04)",
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(232,224,216,0.08)"}`,
              }}
            >
              \uD83D\uDCF8 Take a new photo
            </button>
          </div>
        </motion.div>
      )}

      {/* ── BioFigure with Weight Loss Tracker ── */}
      <div className="px-4 pb-4">
        <div className="h-px w-full mb-4"
          style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : `linear-gradient(90deg, transparent, ${W.terra}15, transparent)` }} />

        <div className="flex items-start gap-4">
          {/* BioFigure */}
          <TransformBioFigure calorieRatio={calorieRatio} ghostMode={ghostMode} />

          {/* Metrics panel */}
          <div className="flex-1 flex flex-col gap-3 pt-2">
            {/* Calorie deficit indicator */}
            <div className="rounded-xl p-3" style={{
              background: ghostMode ? "rgba(160,160,160,0.03)" : `${W.terra}06`,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}10`}`,
            }}>
              <span className="text-[9px] font-medium tracking-wider uppercase block mb-1.5"
                style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim }}>
                Daily Deficit
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-light tabular-nums"
                  style={{ color: ghostMode ? "rgba(160,160,160,0.6)" : calorieRatio < 0.5 ? W.sage : W.terra }}>
                  {Math.round((1 - calorieRatio) * 800)}
                </span>
                <span className="text-[10px]" style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : W.textDim }}>
                  cal deficit
                </span>
              </div>
              {/* Deficit bar */}
              <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden"
                style={{ background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(232,224,216,0.06)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round((1 - calorieRatio) * 100)}%` }}
                  transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full rounded-full"
                  style={{
                    background: ghostMode ? "rgba(160,160,160,0.25)" : `linear-gradient(90deg, ${W.sage}88, ${W.sage})`,
                  }}
                />
              </div>
            </div>

            {/* Projected timeline */}
            <div className="rounded-xl p-3" style={{
              background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(26,24,22,0.5)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(42,38,34,0.4)"}`,
            }}>
              <span className="text-[9px] font-medium tracking-wider uppercase block mb-2"
                style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim }}>
                Your Timeline
              </span>
              {[
                { day: "Day 30", label: "You'll start to see changes", icon: "\uD83C\uDFAF" },
                { day: "Day 60", label: "Others will notice too", icon: "\u26A1" },
                { day: "Day 90", label: "Full transformation", icon: "\uD83C\uDFC6" },
              ].map((m, i) => (
                <div key={m.day} className="flex items-center gap-2 mb-1.5 last:mb-0">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}${10 + i * 5}`,
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.terra}${15 + i * 8}`}`,
                    }}>
                    {m.icon}
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-semibold block"
                      style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : W.textSecondary }}>
                      {m.day}
                    </span>
                    <span className="text-[9px]"
                      style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : W.textDim }}>
                      {m.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
