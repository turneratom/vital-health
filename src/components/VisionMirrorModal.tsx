import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostMode } from "@/components/Presence/usePresenceState";

interface VisionMirrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit?: () => void;
}

/* ── Before/After Slider for mobile ── */
function BeforeAfterSlider({
  beforeSrc,
  neon,
  accentHex,
}: {
  beforeSrc: string;
  neon: string;
  accentHex: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const dragging = useRef(false);

  const updatePos = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePos(e.clientX);
  }, [updatePos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    updatePos(e.clientX);
  }, [updatePos]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[3/4] rounded-xl overflow-hidden touch-none select-none"
      style={{
        border: `1.5px solid rgba(${neon},0.15)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* After (full background — enhanced) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${beforeSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "contrast(1.1) saturate(1.15) brightness(1.05)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, rgba(${neon},0.08) 0%, transparent 50%, rgba(107,138,255,0.06) 100%)`,
        }}
      />

      {/* Before (clipped by slider) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <div
          className="h-full"
          style={{
            width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100vw",
            backgroundImage: `url(${beforeSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>

      {/* Slider line + handle */}
      <div
        className="absolute top-0 bottom-0 z-20"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
      >
        <div
          className="w-[2px] h-full"
          style={{
            background: accentHex,
            boxShadow: `0 0 8px rgba(${neon},0.5)`,
          }}
        />
        {/* Drag handle — 48px touch target */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.7)",
            border: `2px solid ${accentHex}`,
            boxShadow: `0 0 16px rgba(${neon},0.4)`,
            backdropFilter: "blur(8px)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentHex} strokeWidth="2" strokeLinecap="round">
            <path d="M8 12H4l4-4M8 12H4l4 4M16 12h4l-4-4M16 12h4l-4 4" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div
        className="absolute top-3 left-3 px-3 py-1.5 rounded-full z-10"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border: `1px solid rgba(${neon},0.15)`,
        }}
      >
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `rgba(${neon},0.7)` }}>
          Day 0
        </span>
      </div>
      <div
        className="absolute top-3 right-3 px-3 py-1.5 rounded-full z-10"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(107,138,255,0.25)",
        }}
      >
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "rgba(107,138,255,0.8)" }}>
          Day 90
        </span>
      </div>
    </div>
  );
}

export function VisionMirrorModal({ isOpen, onClose, onCommit }: VisionMirrorModalProps) {
  const ghostMode = useGhostMode();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProjecting, setIsProjecting] = useState(false);
  const [projectionReady, setProjectionReady] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [commitPulse, setCommitPulse] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanLineRef = useRef(0);
  const animRef = useRef(0);
  const [scanY, setScanY] = useState(0);

  const neon = ghostMode ? "160,160,160" : "0,255,204";
  const accentHex = ghostMode ? "#a0a0a0" : "#00FFCC";

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Scan line animation when projecting
  useEffect(() => {
    if (!isProjecting) return;
    const animate = () => {
      scanLineRef.current = (scanLineRef.current + 0.8) % 100;
      setScanY(scanLineRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isProjecting]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      setProjectionReady(false);
      setCommitted(false);
      setIsProjecting(true);
      setTimeout(() => {
        setIsProjecting(false);
        setProjectionReady(true);
      }, 3200);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleCommit = useCallback(() => {
    setCommitPulse(true);
    setCommitted(true);
    setTimeout(() => setCommitPulse(false), 1200);
    onCommit?.();
  }, [onCommit]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal — full-screen on mobile */}
          <motion.div
            className="relative w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl md:w-[95vw]"
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{
              background: "rgba(8,8,8,0.85)",
              border: `1px solid rgba(${neon},0.12)`,
              boxShadow: `0 0 60px rgba(${neon},0.06), 0 0 120px rgba(${neon},0.03), inset 0 1px 0 rgba(255,255,255,0.04)`,
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              ...(isMobile ? { width: "100vw", maxWidth: "100vw", maxHeight: "100vh", borderRadius: "16px 16px 0 0", position: "fixed" as const, bottom: 0, left: 0, right: 0 } : {}),
            }}
          >
            {/* Commit pulse flash */}
            <AnimatePresence>
              {commitPulse && (
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none z-50"
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  style={{
                    background: `radial-gradient(circle at center, rgba(${neon},0.15) 0%, transparent 70%)`,
                  }}
                />
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between px-5 md:px-8 pt-5 md:pt-8 pb-2">
              <div className="flex flex-col gap-1">
                <h2
                  className="text-xl sm:text-2xl md:text-3xl font-light tracking-tight"
                  style={{ color: "rgba(255,255,255,0.9)" }}
                >
                  Vision Mirror
                </h2>
                <p
                  className="text-xs sm:text-sm font-light"
                  style={{ color: `rgba(${neon},0.45)` }}
                >
                  {isMobile ? "Swipe to compare Before & After" : "See your 90-day transformation. Upload a photo to begin."}
                </p>
              </div>
              {/* Close button — 44px touch target */}
              <button
                onClick={onClose}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 18 }}>&#x2715;</span>
              </button>
            </div>

            {/* Content */}
            <div className="px-5 md:px-8 py-4 md:py-6">
              {/* Upload area (shown when no image) */}
              {!uploadedImage && (
                <div
                  className="relative aspect-[3/4] max-h-[50vh] rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: `1.5px dashed rgba(${neon},${dragOver ? 0.5 : 0.12})`,
                    boxShadow: dragOver ? `0 0 30px rgba(${neon},0.1)` : "none",
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{
                        background: `rgba(${neon},0.06)`,
                        border: `1px solid rgba(${neon},0.1)`,
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={`rgba(${neon},0.4)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-light" style={{ color: `rgba(${neon},0.5)` }}>
                        Upload or drag a photo
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: `rgba(${neon},0.25)` }}>
                        JPG, PNG, WEBP
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Projecting state */}
              {isProjecting && uploadedImage && (
                <div
                  className="relative aspect-[3/4] max-h-[50vh] rounded-xl overflow-hidden"
                  style={{ border: `1.5px solid rgba(${neon},0.1)` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${uploadedImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      filter: "blur(20px) brightness(0.3) saturate(0.5)",
                      opacity: 0.5,
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 h-[2px] pointer-events-none"
                    style={{
                      top: `${scanY}%`,
                      background: `linear-gradient(90deg, transparent, rgba(${neon},0.6), transparent)`,
                      boxShadow: `0 0 20px rgba(${neon},0.3)`,
                    }}
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `linear-gradient(rgba(${neon},0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(${neon},0.08) 1px, transparent 1px)`,
                      backgroundSize: "20px 20px",
                      opacity: 0.5,
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                    <div className="relative w-12 h-12">
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        style={{ border: `2px solid rgba(${neon},0.1)`, borderTopColor: accentHex }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <span className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: `rgba(${neon},0.6)` }}>
                      Projecting...
                    </span>
                    <motion.div className="w-32 h-1 rounded-full overflow-hidden" style={{ background: `rgba(${neon},0.08)` }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, ease: "easeInOut" }}
                        style={{ background: accentHex, boxShadow: `0 0 10px rgba(${neon},0.4)` }}
                      />
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Result — Mobile: Swipeable slider / Desktop: Side-by-side */}
              {projectionReady && uploadedImage && !isProjecting && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
                  {isMobile ? (
                    /* ── MOBILE: Before/After Slider ── */
                    <BeforeAfterSlider beforeSrc={uploadedImage} neon={neon} accentHex={accentHex} />
                  ) : (
                    /* ── DESKTOP: Side-by-side ── */
                    <div className="grid grid-cols-2 gap-6">
                      {/* Before */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: accentHex, boxShadow: `0 0 8px rgba(${neon},0.4)` }} />
                          <span className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: `rgba(${neon},0.5)` }}>Current Photo</span>
                        </div>
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden" style={{ border: `1.5px solid rgba(${neon},0.15)` }}>
                          <img src={uploadedImage} alt="Current" className="w-full h-full object-cover" />
                          <div className="absolute top-3 left-3 px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: `1px solid rgba(${neon},0.15)` }}>
                            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `rgba(${neon},0.7)` }}>Day 0</span>
                          </div>
                        </div>
                      </div>
                      {/* After */}
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: "#6B8AFF", boxShadow: "0 0 8px rgba(107,138,255,0.4)" }} />
                          <span className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: `rgba(${neon},0.5)` }}>AI Reality — 90 Day</span>
                        </div>
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden" style={{ border: "1.5px solid rgba(107,138,255,0.2)" }}>
                          <div className="absolute inset-0" style={{ backgroundImage: `url(${uploadedImage})`, backgroundSize: "cover", backgroundPosition: "center", filter: "contrast(1.1) saturate(1.15) brightness(1.05)" }} />
                          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, rgba(${neon},0.08) 0%, transparent 50%, rgba(107,138,255,0.06) 100%)` }} />
                          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)" }} />
                          <div className="absolute top-3 left-3 px-3 py-1 rounded-full" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(107,138,255,0.25)" }}>
                            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "rgba(107,138,255,0.8)" }}>Day 90</span>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `rgba(${neon},0.5)` }}>Projected</span>
                                <span className="text-lg font-light" style={{ color: accentHex }}>-8% body fat</span>
                              </div>
                              <div className="w-px h-8" style={{ background: `rgba(${neon},0.15)` }} />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `rgba(${neon},0.5)` }}>Muscle</span>
                                <span className="text-lg font-light" style={{ color: "#6B8AFF" }}>+4.2 lbs</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Projected stats for mobile */}
                  {isMobile && (
                    <div className="flex items-center justify-center gap-6 mt-4 px-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `rgba(${neon},0.5)` }}>Projected</span>
                        <span className="text-lg font-light" style={{ color: accentHex }}>-8% body fat</span>
                      </div>
                      <div className="w-px h-8" style={{ background: `rgba(${neon},0.15)` }} />
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: `rgba(${neon},0.5)` }}>Muscle</span>
                        <span className="text-lg font-light" style={{ color: "#6B8AFF" }}>+4.2 lbs</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Re-upload button when image exists but not projecting */}
              {uploadedImage && !isProjecting && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 w-full py-3 min-h-[48px] rounded-xl font-mono text-xs uppercase tracking-wider transition-all duration-200"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid rgba(${neon},0.08)`,
                    color: `rgba(${neon},0.4)`,
                  }}
                >
                  Upload Different Photo
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {/* Protocol Summary */}
            {projectionReady && (
              <motion.div
                className="px-5 md:px-8 pb-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div
                  className="rounded-xl p-4 md:p-5"
                  style={{
                    background: `rgba(${neon},0.03)`,
                    border: `1px solid rgba(${neon},0.06)`,
                  }}
                >
                  <span
                    className="text-[10px] font-mono uppercase tracking-[0.2em] block mb-3"
                    style={{ color: `rgba(${neon},0.4)` }}
                  >
                    Your 90-Day Protocol
                  </span>
                  {/* Responsive: 1 col on mobile, 3 cols on desktop */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    {[
                      { label: "Food", value: "2,400 cal/day", sub: "High protein, moderate carb" },
                      { label: "Activity", value: "5x / week", sub: "Strength + HIIT split" },
                      { label: "Recovery", value: "7.5h sleep", sub: "Cold exposure 3x/week" },
                    ].map((item) => (
                      <div key={item.label} className="flex sm:flex-col gap-2 sm:gap-1 items-center sm:items-start">
                        <span className="text-[10px] font-mono uppercase tracking-wider min-w-[60px]" style={{ color: `rgba(${neon},0.35)` }}>{item.label}</span>
                        <span className="text-sm sm:text-base font-light" style={{ color: "rgba(255,255,255,0.8)" }}>{item.value}</span>
                        <span className="text-[11px] font-light hidden sm:block" style={{ color: `rgba(${neon},0.3)` }}>{item.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Commit Button — 48px min height for touch */}
            <div className="px-5 md:px-8 pt-4 pb-6 md:pb-8">
              {committed ? (
                <motion.div
                  className="flex flex-col items-center gap-3 py-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: `rgba(${neon},0.1)`,
                      border: `2px solid rgba(${neon},0.3)`,
                      boxShadow: `0 0 30px rgba(${neon},0.15)`,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={accentHex} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="text-lg font-light" style={{ color: "rgba(255,255,255,0.8)" }}>Locked In</span>
                  <span className="text-sm font-light text-center" style={{ color: `rgba(${neon},0.4)` }}>
                    Your 90-day transformation starts now.
                  </span>
                </motion.div>
              ) : (
                <motion.button
                  onClick={handleCommit}
                  disabled={!projectionReady}
                  className="w-full py-4 min-h-[48px] rounded-xl font-mono uppercase tracking-[0.15em] text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: projectionReady
                      ? `linear-gradient(135deg, rgba(${neon},0.15) 0%, rgba(${neon},0.08) 100%)`
                      : "rgba(255,255,255,0.02)",
                    border: `1.5px solid rgba(${neon},${projectionReady ? 0.3 : 0.06})`,
                    color: projectionReady ? accentHex : `rgba(${neon},0.2)`,
                    boxShadow: projectionReady
                      ? `0 0 30px rgba(${neon},0.08), inset 0 0 20px rgba(${neon},0.04)`
                      : "none",
                  }}
                  whileHover={projectionReady ? { boxShadow: `0 0 40px rgba(${neon},0.15)`, scale: 1.01 } : {}}
                  whileTap={projectionReady ? { scale: 0.98 } : {}}
                >
                  {projectionReady ? "Commit to 90 Days" : "Upload a photo to begin"}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
