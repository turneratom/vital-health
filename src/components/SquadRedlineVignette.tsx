import { useState, useEffect } from "react";

/**
 * Squad Redline Vignette — Full-screen red pulsing overlay
 * Listens for "vive-squad-readiness" events and renders a subtle
 * red pulsing vignette when the squad enters redline state.
 */
export function SquadRedlineVignette() {
  const [active, setActive] = useState(false);
  const [severity, setSeverity] = useState<"optimal" | "warning" | "critical">("optimal");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActive(!!detail?.isRedline);
      setSeverity(detail?.status ?? "optimal");
    };
    window.addEventListener("vive-squad-readiness", handler);
    return () => window.removeEventListener("vive-squad-readiness", handler);
  }, []);

  if (!active) return null;

  const isCritical = severity === "critical";

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 9998 }}>
      {/* Top edge */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: isCritical ? 120 : 80,
          background: isCritical
            ? "linear-gradient(180deg, rgba(255,20,20,0.18) 0%, rgba(255,20,20,0.06) 40%, transparent 100%)"
            : "linear-gradient(180deg, rgba(255,59,48,0.12) 0%, rgba(255,59,48,0.03) 40%, transparent 100%)",
          animation: "vignetteTopPulse 2.5s ease-in-out infinite",
        }}
      />
      {/* Bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: isCritical ? 100 : 60,
          background: isCritical
            ? "linear-gradient(0deg, rgba(255,20,20,0.15) 0%, rgba(255,20,20,0.04) 40%, transparent 100%)"
            : "linear-gradient(0deg, rgba(255,59,48,0.08) 0%, rgba(255,59,48,0.02) 40%, transparent 100%)",
          animation: "vignetteBottomPulse 2.5s ease-in-out infinite 0.3s",
        }}
      />
      {/* Left edge */}
      <div
        className="absolute top-0 bottom-0 left-0"
        style={{
          width: isCritical ? 60 : 40,
          background: isCritical
            ? "linear-gradient(90deg, rgba(255,20,20,0.12) 0%, transparent 100%)"
            : "linear-gradient(90deg, rgba(255,59,48,0.06) 0%, transparent 100%)",
          animation: "vignetteSidePulse 2.5s ease-in-out infinite 0.15s",
        }}
      />
      {/* Right edge */}
      <div
        className="absolute top-0 bottom-0 right-0"
        style={{
          width: isCritical ? 60 : 40,
          background: isCritical
            ? "linear-gradient(270deg, rgba(255,20,20,0.12) 0%, transparent 100%)"
            : "linear-gradient(270deg, rgba(255,59,48,0.06) 0%, transparent 100%)",
          animation: "vignetteSidePulse 2.5s ease-in-out infinite 0.15s",
        }}
      />
      {/* Corner intensifiers */}
      {isCritical && (
        <>
          <div className="absolute top-0 left-0 w-32 h-32" style={{
            background: "radial-gradient(circle at 0% 0%, rgba(255,20,20,0.14) 0%, transparent 70%)",
            animation: "vignetteCornerPulse 3s ease-in-out infinite",
          }} />
          <div className="absolute top-0 right-0 w-32 h-32" style={{
            background: "radial-gradient(circle at 100% 0%, rgba(255,20,20,0.14) 0%, transparent 70%)",
            animation: "vignetteCornerPulse 3s ease-in-out infinite 0.5s",
          }} />
          <div className="absolute bottom-0 left-0 w-32 h-32" style={{
            background: "radial-gradient(circle at 0% 100%, rgba(255,20,20,0.10) 0%, transparent 70%)",
            animation: "vignetteCornerPulse 3s ease-in-out infinite 1s",
          }} />
          <div className="absolute bottom-0 right-0 w-32 h-32" style={{
            background: "radial-gradient(circle at 100% 100%, rgba(255,20,20,0.10) 0%, transparent 70%)",
            animation: "vignetteCornerPulse 3s ease-in-out infinite 1.5s",
          }} />
        </>
      )}
      <style>{`
        @keyframes vignetteTopPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes vignetteBottomPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
        @keyframes vignetteSidePulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes vignetteCornerPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
