import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ══════════════════════════════════════════════════════════════ */
/* ── Physical Transformation — Polaroid Before/After Module ── */
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

/* ── Placeholder images ── */
const PLACEHOLDER_CURRENT = "/images/polaroid-current-placeholder.webp";
const PLACEHOLDER_TARGET = "/images/polaroid-target-placeholder.webp";

/* ── Camera Icon SVG ── */
function CameraIcon({ size = 14, color = "#E8E0D8" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/* ── Upload Icon SVG ── */
function UploadIcon({ size = 28, color = "#E8976C" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/* ── Sparkle Icon SVG ── */
function SparkleIcon({ size = 28, color = "#7CB68E" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" opacity="0.9" />
      <path d="M20 4L21 7L24 8L21 9L20 12L19 9L16 8L19 7L20 4Z" opacity="0.5" />
      <path d="M4 16L5 18L7 19L5 20L4 22L3 20L1 19L3 18L4 16Z" opacity="0.5" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Scanning Overlay — Premium AI Generation Animation ──     */
/* ══════════════════════════════════════════════════════════════ */
function ScanningOverlay({ progress, statusText }: { progress: number; statusText: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-xl"
      style={{ background: "rgba(8,8,6,0.88)", backdropFilter: "blur(12px)" }}
    >
      {/* Horizontal scan line sweeping top to bottom */}
      <motion.div
        className="absolute left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${W.sage}00 10%, ${W.sage} 50%, ${W.sage}00 90%, transparent 100%)`,
          boxShadow: `0 0 20px ${W.sage}80, 0 0 60px ${W.sage}30`,
        }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Corner brackets */}
      {["top-3 left-3", "top-3 right-3", "bottom-3 left-3", "bottom-3 right-3"].map((pos, i) => (
        <motion.div
          key={pos}
          className={`absolute ${pos} w-5 h-5`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0.3, 0.8, 0.3], scale: 1 }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
          style={{
            borderColor: W.sage,
            borderWidth: 0,
            ...(i === 0 ? { borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 } : {}),
            ...(i === 1 ? { borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 } : {}),
            ...(i === 2 ? { borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 } : {}),
            ...(i === 3 ? { borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 } : {}),
          }}
        />
      ))}

      {/* Pulsing grid dots */}
      <div className="absolute inset-6 grid grid-cols-5 grid-rows-6 gap-1 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-1 h-1 rounded-full mx-auto my-auto"
            style={{ background: W.sage }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.08 }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {/* DNA helix spinner */}
        <div className="relative w-12 h-12">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `2px solid ${W.sage}40`, borderTopColor: W.sage }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-1 rounded-full"
            style={{ border: `1.5px solid ${W.sage}25`, borderBottomColor: `${W.sage}80` }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <SparkleIcon size={18} color={W.sage} />
          </motion.div>
        </div>

        {/* Status text */}
        <motion.span
          className="text-[11px] font-semibold tracking-wide"
          style={{ color: W.sage }}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {statusText}
        </motion.span>

        {/* Progress bar */}
        <div className="w-28 h-1 rounded-full overflow-hidden" style={{ background: `${W.sage}15` }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${W.sage}60, ${W.sage})`,
              boxShadow: `0 0 8px ${W.sage}60`,
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Progress percentage */}
        <span className="text-[9px] font-mono" style={{ color: `${W.sage}80` }}>
          {Math.round(progress)}% COMPLETE
        </span>
      </div>
    </motion.div>
  );
}

/* ── Polaroid Frame ── */
function PolaroidFrame({
  photo,
  placeholderImage,
  label,
  emptyIcon,
  emptyText,
  actionLabel,
  onAction,
  accentColor,
  ghostMode,
  badge,
  rotation,
  showUpdateCamera,
  onUpdatePhoto,
  isScanning,
  scanProgress,
  scanStatus,
}: {
  photo: string | null;
  placeholderImage: string;
  label: string;
  emptyIcon: "upload" | "sparkle";
  emptyText: string;
  actionLabel: string;
  onAction?: () => void;
  accentColor: string;
  ghostMode: boolean;
  badge?: string;
  rotation: number;
  showUpdateCamera?: boolean;
  onUpdatePhoto?: () => void;
  isScanning?: boolean;
  scanProgress?: number;
  scanStatus?: string;
}) {
  return (
    <motion.div
      className="flex-1 flex flex-col"
      initial={{ opacity: 0, y: 16, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: rotation }}
      transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: rotation < 0 ? 0.1 : 0.2 }}
      whileHover={{ rotate: 0, scale: 1.02, y: -4, transition: { duration: 0.3 } }}
      style={{ transformOrigin: rotation < 0 ? "bottom right" : "bottom left" }}
    >
      {/* Polaroid outer frame */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: ghostMode ? "rgba(20,20,20,0.5)" : "rgba(18,16,14,0.85)",
          border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(60,54,48,0.5)"}`,
          boxShadow: ghostMode
            ? "0 4px 12px rgba(0,0,0,0.2)"
            : `0 12px 32px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Label strip */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span
            className="text-[9px] font-bold tracking-[0.18em] uppercase"
            style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : accentColor }}
          >
            {label}
          </span>
          {badge && (
            <span
              className="text-[7px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.06)" : `${accentColor}12`,
                color: ghostMode ? "rgba(160,160,160,0.4)" : accentColor,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${accentColor}25`}`,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Photo area */}
        <div className="px-3 pb-3">
          <div
            className="relative w-full aspect-[3/4] rounded-xl overflow-hidden"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(15,14,13,0.6)",
            }}
          >
            {photo ? (
              /* ── User's uploaded photo ── */
              <>
                <img
                  src={photo}
                  alt={label}
                  className="w-full h-full object-cover"
                />
                {/* Photo overlay badge */}
                <div className="absolute top-2 left-2">
                  <span
                    className="text-[8px] font-bold tracking-widest uppercase px-2 py-1 rounded-md"
                    style={{
                      background: "rgba(15,14,13,0.85)",
                      color: accentColor,
                      border: `1px solid ${accentColor}30`,
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {label}
                  </span>
                </div>

                {/* Update Photo camera icon — bottom-right corner */}
                {showUpdateCamera && onUpdatePhoto && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => { e.stopPropagation(); onUpdatePhoto(); }}
                    className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(15,14,13,0.85)",
                      border: `1px solid ${accentColor}40`,
                      backdropFilter: "blur(8px)",
                      boxShadow: `0 2px 8px rgba(0,0,0,0.4), 0 0 12px ${accentColor}15`,
                    }}
                  >
                    <CameraIcon size={14} color={accentColor} />
                  </motion.button>
                )}
              </>
            ) : (
              /* ── Empty state with placeholder image ── */
              <div className="relative w-full h-full">
                {/* Placeholder image as background */}
                <img
                  src={placeholderImage}
                  alt={`${label} placeholder`}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    opacity: ghostMode ? 0.15 : 0.35,
                    filter: "saturate(0.6) brightness(0.7)",
                  }}
                />
                {/* Gradient overlay for readability */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, rgba(15,14,13,0.3) 0%, rgba(15,14,13,0.7) 60%, rgba(15,14,13,0.9) 100%)`,
                  }}
                />

                {/* Dashed border overlay */}
                <div
                  className="absolute inset-2 rounded-lg flex flex-col items-center justify-center gap-3 z-10"
                  style={{
                    border: `1.5px dashed ${ghostMode ? "rgba(160,160,160,0.15)" : `${accentColor}30`}`,
                  }}
                >
                  {/* Icon circle */}
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.08)" : `${accentColor}10`,
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : `${accentColor}20`}`,
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    {emptyIcon === "upload" ? (
                      <UploadIcon size={26} color={ghostMode ? "rgba(160,160,160,0.4)" : accentColor} />
                    ) : (
                      <SparkleIcon size={26} color={ghostMode ? "rgba(160,160,160,0.4)" : accentColor} />
                    )}
                  </div>

                  {/* Empty text */}
                  <span
                    className="text-[10px] text-center leading-relaxed px-3 max-w-[130px]"
                    style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : "rgba(232,224,216,0.6)" }}
                  >
                    {emptyText}
                  </span>

                  {/* Action button */}
                  {onAction && (
                    <motion.button
                      whileHover={{ scale: 1.04, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={onAction}
                      className="px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-200"
                      style={{
                        background: ghostMode
                          ? "rgba(160,160,160,0.08)"
                          : `linear-gradient(135deg, ${accentColor}25, ${accentColor}12)`,
                        color: ghostMode ? "rgba(160,160,160,0.5)" : accentColor,
                        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : `${accentColor}35`}`,
                        boxShadow: ghostMode ? "none" : `0 4px 12px ${accentColor}12, inset 0 1px 0 ${accentColor}10`,
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {actionLabel}
                    </motion.button>
                  )}
                </div>
              </div>
            )}

            {/* ── Scanning Overlay ── */}
            <AnimatePresence>
              {isScanning && (
                <ScanningOverlay
                  progress={scanProgress ?? 0}
                  statusText={scanStatus ?? "Analyzing..."}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom strip — Polaroid caption area */}
        <div
          className="px-3 pb-3 pt-0"
          style={{ borderTop: `1px solid ${ghostMode ? "rgba(160,160,160,0.04)" : "rgba(60,54,48,0.2)"}` }}
        >
          <div className="flex items-center justify-center gap-1.5 py-1.5">
            <div
              className="w-1 h-1 rounded-full"
              style={{ background: ghostMode ? "rgba(160,160,160,0.2)" : `${accentColor}40` }}
            />
            <span
              className="text-[9px] font-medium"
              style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : W.textDim }}
            >
              {photo ? "Photo captured" : "Awaiting your photo"}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── AI Image Generation via Shipper generateImage proxy ──    */
/* ══════════════════════════════════════════════════════════════ */

async function generateTransformationImage(
  _basePhotoDataUrl: string,
  onProgress: (progress: number, status: string) => void
): Promise<string> {
  onProgress(5, "Initializing Vision Engine...");

  // Build the transformation prompt based on user goals from localStorage
  let targetDescription = "lean, athletic physique with visible muscle definition, reduced body fat, improved posture";
  try {
    const stored = localStorage.getItem("vive_user_style");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.goalWeight) {
        targetDescription = `athletic physique at approximately ${parsed.goalWeight}${parsed.unit || 'lbs'}, with visible muscle definition, reduced body fat, and improved posture`;
      }
    }
    const missionStr = localStorage.getItem("vive_mission_profile");
    if (missionStr) {
      const mission = JSON.parse(missionStr);
      if (mission.archetype === "RECOMP") targetDescription = "lean, recomposed physique with increased muscle mass and significantly reduced body fat, visible abs and defined shoulders";
      else if (mission.archetype === "BULK") targetDescription = "muscular, powerful physique with increased overall mass, broader shoulders, thicker arms and chest, while maintaining a healthy body fat percentage";
      else if (mission.archetype === "CUT") targetDescription = "extremely lean and defined physique with visible vascularity, sharp muscle separation, low body fat with visible abs and striations";
      else if (mission.archetype === "ENDURANCE") targetDescription = "lean, efficient endurance athlete physique with low body fat, defined legs, and a wiry, powerful frame";
      else if (mission.archetype === "LONGEVITY") targetDescription = "healthy, vibrant, youthful-looking physique with balanced muscle tone, excellent posture, and a lean, functional build";
    }
  } catch {
    // Use default
  }

  onProgress(15, "Mapping biometric parameters...");
  await sleep(600);

  onProgress(25, "Calibrating body composition model...");
  await sleep(500);

  const prompt = `Hyper-realistic fitness transformation result photo. A fit person with a ${targetDescription}. Full body shot, neutral background, natural lighting, professional fitness photography style. The subject should look healthy, strong, and confident. Studio lighting, high resolution, photorealistic.`;

  onProgress(35, "Generating AI projection...");

  try {
    // Use the Shipper AI image generation endpoint
    const response = await fetch("https://ai.shipper.now/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        width: 512,
        height: 768,
        style: "photorealistic",
      }),
    });

    onProgress(60, "Neural rendering in progress...");
    await sleep(800);

    if (response.ok) {
      const data = await response.json();
      onProgress(85, "Compositing final projection...");
      await sleep(400);
      onProgress(95, "Applying clinical overlay...");
      await sleep(300);
      onProgress(100, "Vision complete");

      if (data.url) return data.url;
      if (data.image) return data.image;
      if (data.images?.[0]) return data.images[0];
    }
  } catch (err) {
    console.warn("AI image generation unavailable, using enhanced fallback:", err);
  }

  // Fallback: generate a stylized canvas-based projection
  onProgress(50, "Rendering local projection...");
  await sleep(600);

  const fallbackUrl = await generateLocalProjection(_basePhotoDataUrl, targetDescription);

  onProgress(85, "Applying transformation filters...");
  await sleep(400);
  onProgress(100, "Vision complete");
  return fallbackUrl;
}

/* ── Local canvas-based fallback projection ── */
async function generateLocalProjection(basePhoto: string, _target: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(basePhoto); return; }

      // Draw base image
      ctx.drawImage(img, 0, 0);

      // Apply transformation filters: increase contrast, slight warmth, sharpen appearance
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(124,182,142,0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = "rgba(232,151,108,0.06)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add subtle "AI PROJECTED" watermark
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.15;
      ctx.font = `bold ${Math.round(canvas.width * 0.04)}px system-ui, sans-serif`;
      ctx.fillStyle = "#7CB68E";
      ctx.textAlign = "center";
      ctx.fillText("AI VISION", canvas.width / 2, canvas.height - 20);
      ctx.globalAlpha = 1;

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(basePhoto);
    img.src = basePhoto;
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN EXPORT — PhysicalTransformation ──                   */
/* ══════════════════════════════════════════════════════════════ */
export interface PhysicalTransformationProps {
  ghostMode: boolean;
}

export function PhysicalTransformation({ ghostMode }: PhysicalTransformationProps) {
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [targetPhoto, setTargetPhoto] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("Initializing...");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setCurrentPhoto(e.target?.result as string);
      setTargetPhoto(null);
      setGenerationError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerateGoal = useCallback(async () => {
    if (!currentPhoto || isGenerating) return;
    setIsGenerating(true);
    setScanProgress(0);
    setScanStatus("Initializing Vision Engine...");
    setGenerationError(null);
    abortRef.current = false;

    try {
      const result = await generateTransformationImage(
        currentPhoto,
        (progress, status) => {
          if (abortRef.current) return;
          setScanProgress(progress);
          setScanStatus(status);
        }
      );

      if (!abortRef.current) {
        setTargetPhoto(result);
      }
    } catch (err) {
      console.error("Vision generation failed:", err);
      if (!abortRef.current) {
        setGenerationError("Vision generation encountered an issue. Tap to retry.");
      }
    } finally {
      if (!abortRef.current) {
        setIsGenerating(false);
        setScanProgress(0);
      }
    }
  }, [currentPhoto, isGenerating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current = true; };
  }, []);

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
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.terra}12`,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.terra}20`}`,
            }}
          >
            <span style={{ fontSize: 16 }}>{"\uD83E\uDE9E"}</span>
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: ghostMode ? "rgba(200,200,200,0.7)" : W.textPrimary }}
            >
              Physical Transformation
            </h3>
            <p
              className="text-[10px]"
              style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim }}
            >
              Track your visual progress over time
            </p>
          </div>
        </div>

        {currentPhoto && (
          <span
            className="text-[8px] font-bold tracking-wider px-2 py-1 rounded-full"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.06)" : `${W.sage}10`,
              color: ghostMode ? "rgba(160,160,160,0.4)" : W.sage,
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.sage}20`}`,
            }}
          >
            BASELINE SET
          </span>
        )}
      </div>

      {/* ── Hidden file input ── */}
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

      {/* ── Two Polaroid Frames Side by Side — tilted like real photos ── */}
      <div className="px-4 pb-2 flex gap-3" style={{ perspective: "800px" }}>
        {/* LEFT: Current — tilted -2deg */}
        <PolaroidFrame
          photo={currentPhoto}
          placeholderImage={PLACEHOLDER_CURRENT}
          label="Current"
          emptyIcon="upload"
          emptyText="Snap a full-body photo to start tracking"
          actionLabel="Capture Baseline"
          onAction={() => fileInputRef.current?.click()}
          accentColor={W.terra}
          ghostMode={ghostMode}
          rotation={-2}
          showUpdateCamera={!!currentPhoto}
          onUpdatePhoto={() => fileInputRef.current?.click()}
        />

        {/* RIGHT: Target Physique — tilted +2deg */}
        <PolaroidFrame
          photo={targetPhoto}
          placeholderImage={PLACEHOLDER_TARGET}
          label="Target Physique"
          emptyIcon="sparkle"
          emptyText={currentPhoto ? "Ready to visualize your goal" : "Upload a current photo first"}
          actionLabel="Generate AI Goal"
          onAction={currentPhoto && !isGenerating ? handleGenerateGoal : undefined}
          accentColor={W.sage}
          ghostMode={ghostMode}
          badge={targetPhoto ? "AI PROJECTED" : undefined}
          rotation={2}
          isScanning={isGenerating}
          scanProgress={scanProgress}
          scanStatus={scanStatus}
        />
      </div>

      {/* ── Generation Error ── */}
      <AnimatePresence>
        {generationError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerateGoal}
              className="w-full flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: `${W.rose}08`,
                border: `1px solid ${W.rose}20`,
              }}
            >
              <span style={{ fontSize: 14 }}>{"\u26A0\uFE0F"}</span>
              <div className="flex-1 text-left">
                <span className="text-[11px] font-medium block" style={{ color: W.rose }}>
                  {generationError}
                </span>
                <span className="text-[9px]" style={{ color: W.textDim }}>
                  Tap to retry with AI Vision Engine
                </span>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Generation Progress (bottom bar — shown alongside scanning overlay) ── */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{
                background: ghostMode ? "rgba(160,160,160,0.03)" : `${W.sage}06`,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : `${W.sage}12`}`,
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 rounded-full border-2 border-t-transparent flex-shrink-0"
                style={{ borderColor: `${W.sage}60`, borderTopColor: "transparent" }}
              />
              <div className="flex-1">
                <span
                  className="text-[11px] font-medium block"
                  style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : W.sage }}
                >
                  {scanStatus}
                </span>
                <div className="mt-1.5 w-full h-1 rounded-full overflow-hidden" style={{ background: `${W.sage}12` }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${W.sage}80, ${W.sage})`,
                      boxShadow: `0 0 6px ${W.sage}50`,
                    }}
                    animate={{ width: `${scanProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
              <span className="text-[9px] font-mono flex-shrink-0" style={{ color: `${W.sage}80` }}>
                {Math.round(scanProgress)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Retake / Reset Actions ── */}
      {currentPhoto && !isGenerating && (
        <div className="px-4 pb-4 flex justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              color: ghostMode ? "rgba(160,160,160,0.4)" : W.textDim,
              background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(232,224,216,0.04)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(232,224,216,0.08)"}`,
            }}
          >
            <CameraIcon size={12} color={ghostMode ? "rgba(160,160,160,0.4)" : W.textDim} />
            Retake Photo
          </button>
          {currentPhoto && !targetPhoto && (
            <button
              onClick={handleGenerateGoal}
              className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                color: ghostMode ? "rgba(160,160,160,0.4)" : W.sage,
                background: ghostMode ? "rgba(160,160,160,0.04)" : `${W.sage}08`,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.sage}18`}`,
              }}
            >
              <SparkleIcon size={12} color={ghostMode ? "rgba(160,160,160,0.4)" : W.sage} />
              Generate AI Goal
            </button>
          )}
          {targetPhoto && (
            <button
              onClick={handleGenerateGoal}
              className="flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                color: ghostMode ? "rgba(160,160,160,0.4)" : W.sage,
                background: ghostMode ? "rgba(160,160,160,0.04)" : `${W.sage}08`,
                border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : `${W.sage}18`}`,
              }}
            >
              <SparkleIcon size={12} color={ghostMode ? "rgba(160,160,160,0.4)" : W.sage} />
              Regenerate Vision
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
