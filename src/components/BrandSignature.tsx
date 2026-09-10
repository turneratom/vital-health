/**
 * BrandSignature — Fixed bottom-right "Created by TURNER" badge
 * Tesla-inspired shield icon with bright cyan (#00F0FF) glow.
 * Positioned ABOVE the bottom nav bar.
 */

export default function BrandSignature() {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 90,
        right: 16,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
        userSelect: "none",
        opacity: 0.6,
      }}
    >
      {/* Tesla-inspired Shield with embedded T */}
      <svg
        width="14"
        height="16"
        viewBox="0 0 28 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: "drop-shadow(0 0 4px rgba(0,240,255,0.55))",
          flexShrink: 0,
        }}
      >
        {/* Shield outline — pointed bottom, curved top */}
        <path
          d="M14 1 L26 5 C26 5 27 14 25 19 C23 24 14 31 14 31 C14 31 5 24 3 19 C1 14 2 5 2 5 L14 1Z"
          stroke="#00F0FF"
          strokeWidth="1.5"
          fill="rgba(0,240,255,0.04)"
          strokeLinejoin="round"
        />
        {/* Inner shield line for depth */}
        <path
          d="M14 4.5 L23.5 7.5 C23.5 7.5 24.2 14.5 22.5 18.5 C21 22 14 27.5 14 27.5 C14 27.5 7 22 5.5 18.5 C3.8 14.5 4.5 7.5 4.5 7.5 L14 4.5Z"
          stroke="#00F0FF"
          strokeWidth="0.6"
          fill="none"
          opacity="0.35"
          strokeLinejoin="round"
        />
        {/* Stylized T — Tesla-style with flared top */}
        <path
          d="M8 10 C8 10 10.5 9 14 9 C17.5 9 20 10 20 10"
          stroke="#00F0FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <line
          x1="14"
          y1="10"
          x2="14"
          y2="22"
          stroke="#00F0FF"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      <span
        style={{
          fontFamily:
            "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.22em",
          color: "#00F0FF",
          textTransform: "uppercase" as const,
          filter: "drop-shadow(0 0 4px rgba(0,240,255,0.45))",
          lineHeight: 1,
          whiteSpace: "nowrap" as const,
        }}
      >
        Created by TURNER
      </span>

      {/* Subtle pulsing dot — "live" power indicator */}
      <span
        style={{
          width: 3.5,
          height: 3.5,
          borderRadius: "50%",
          background: "#00F0FF",
          boxShadow: "0 0 5px rgba(0,240,255,0.7)",
          animation: "brandPulse 2.4s ease-in-out infinite",
          flexShrink: 0,
        }}
      />

      <style>{`
        @keyframes brandPulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
