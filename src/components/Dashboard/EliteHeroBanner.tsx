import { useState, useEffect } from "react";
import { ELITE_BACKGROUNDS_LIST } from "@/data/eliteAssets";
import { useGhostMode } from "@/components/Presence/usePresenceState";

interface EliteHeroBannerProps {
  userName?: string;
  tier?: "core" | "elite";
  className?: string;
}

export function EliteHeroBanner({
  userName = "Operator",
  tier = "elite",
  className = "",
}: EliteHeroBannerProps) {
  const ghostMode = useGhostMode();
  const [bgIndex, setBgIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Rotate backgrounds every 20 seconds
  useEffect(() => {
    if (tier !== "elite") return;
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % ELITE_BACKGROUNDS_LIST.length);
      setImageLoaded(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [tier]);

  // Preload next image
  useEffect(() => {
    const img = new Image();
    img.src = ELITE_BACKGROUNDS_LIST[bgIndex].url;
    img.onload = () => setImageLoaded(true);
  }, [bgIndex]);

  const currentBg = ELITE_BACKGROUNDS_LIST[bgIndex];
  const isElite = tier === "elite";

  const accentColor = ghostMode
    ? "rgba(160, 160, 160,"
    : isElite
      ? "rgba(0, 240, 255,"
      : "rgba(232, 151, 108,";

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return "Deep Focus";
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 21) return "Good Evening";
    return "Night Mode";
  };

  if (!isElite) {
    // Core tier — simple warm banner
    return (
      <div
        className={`relative overflow-hidden rounded-2xl ${className}`}
        style={{
          background: "linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)",
          border: "1px solid rgba(232, 151, 108, 0.08)",
        }}
      >
        <div className="relative z-10 px-6 py-5">
          <p
            className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1"
            style={{ color: "rgba(232, 151, 108, 0.5)" }}
          >
            {greeting()}
          </p>
          <h2
            className="text-lg font-semibold"
            style={{ color: "rgba(232, 224, 216, 0.9)" }}
          >
            {userName}
          </h2>
          <p
            className="text-xs mt-1"
            style={{ color: "rgba(138, 126, 114, 0.7)" }}
          >
            Core Protocol Active
          </p>
        </div>
      </div>
    );
  }

  // Elite tier — cinematic hero with rotating 3D backgrounds
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        minHeight: "160px",
        border: `1px solid ${ghostMode ? "rgba(160,160,160,0.06)" : "rgba(0,240,255,0.08)"}`,
      }}
    >
      {/* Background image with crossfade */}
      <div
        className="absolute inset-0 transition-opacity duration-[2000ms]"
        style={{
          opacity: imageLoaded ? 1 : 0,
          backgroundImage: `url(${currentBg.url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Fallback gradient while loading */}
      <div
        className="absolute inset-0 transition-opacity duration-[2000ms]"
        style={{
          opacity: imageLoaded ? 0 : 1,
          background: ghostMode
            ? "linear-gradient(135deg, #0c0c0c 0%, #080808 100%)"
            : "linear-gradient(135deg, #0a0a1a 0%, #050510 60%, #001020 100%)",
        }}
      />

      {/* Gradient overlay for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, rgba(5,5,8,0.85) 0%, rgba(5,5,8,0.5) 50%, rgba(5,5,8,0.3) 100%)`,
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16"
        style={{
          background: "linear-gradient(to top, rgba(5,5,8,0.9), transparent)",
        }}
      />

      {/* Accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}0.4), transparent)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 px-6 py-6 flex flex-col justify-between min-h-[160px]">
        <div>
          {/* Elite badge */}
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                background: `${accentColor}0.06)`,
                border: `1px solid ${accentColor}0.15)`,
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill={ghostMode ? "rgba(160,160,160,0.6)" : "#00F0FF"}
              >
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              <span
                className="text-[9px] font-mono uppercase tracking-[0.15em] font-medium"
                style={{ color: `${accentColor}0.7)` }}
              >
                Elite
              </span>
            </div>

            {/* Background label */}
            <span
              className="text-[9px] font-mono uppercase tracking-[0.1em]"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              {currentBg.label}
            </span>
          </div>

          {/* Greeting */}
          <p
            className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1"
            style={{ color: `${accentColor}0.4)` }}
          >
            {greeting()}
          </p>
          <h2
            className="text-xl font-semibold tracking-tight"
            style={{ color: "rgba(255,255,255,0.95)" }}
          >
            {userName}
          </h2>
        </div>

        {/* Bottom stats row */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-3">
            {ELITE_BACKGROUNDS_LIST.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setBgIndex(i);
                  setImageLoaded(false);
                }}
                className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                style={{
                  background:
                    i === bgIndex
                      ? `${accentColor}0.8)`
                      : "rgba(255,255,255,0.15)",
                  boxShadow:
                    i === bgIndex
                      ? `0 0 6px ${accentColor}0.4)`
                      : "none",
                  transform: i === bgIndex ? "scale(1.3)" : "scale(1)",
                }}
              />
            ))}
          </div>

          <div
            className="h-3 w-px"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />

          <p
            className="text-[9px] font-mono uppercase tracking-[0.1em]"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            All systems nominal
          </p>
        </div>
      </div>
    </div>
  );
}
