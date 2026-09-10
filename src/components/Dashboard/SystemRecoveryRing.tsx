import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

interface SystemRecoveryRingProps {
  score: number;
  size?: number;
}

export function SystemRecoveryRing({ score, size = 160 }: SystemRecoveryRingProps) {
  const ghostMode = useGhostMode();
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 300);
    return () => clearTimeout(timer);
  }, [score]);

  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const center = size / 2;

  // Neon gradient colors
  const primaryColor = ghostMode ? 'rgba(160,160,160,0.5)' : '#00FFCC';
  const secondaryColor = ghostMode ? 'rgba(120,120,120,0.3)' : '#6B8AFF';
  const glowColor = ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.3)';

  // Score label
  const getLabel = (s: number) => {
    if (s >= 85) return 'Optimal';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Moderate';
    return 'Low';
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          opacity: animatedScore / 100,
          transition: 'opacity 1s ease',
        }}
      />

      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="recovery-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
          <filter id="recovery-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}
          strokeWidth={strokeWidth}
        />

        {/* Tick marks */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = (i / 36) * 360;
          const rad = (angle * Math.PI) / 180;
          const innerR = radius - strokeWidth / 2 - 2;
          const outerR = radius - strokeWidth / 2 + 2;
          const x1 = center + innerR * Math.cos(rad);
          const y1 = center + innerR * Math.sin(rad);
          const x2 = center + outerR * Math.cos(rad);
          const y2 = center + outerR * Math.sin(rad);
          const tickPct = (i / 36) * 100;
          const isActive = tickPct <= animatedScore;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isActive ? (ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.15)') : 'rgba(255,255,255,0.02)'}
              strokeWidth={0.5}
            />
          );
        })}

        {/* Glow ring (behind main) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.25)'}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'blur(4px)',
          }}
        />

        {/* Main progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#recovery-gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: ghostMode ? 'none' : 'url(#recovery-glow)',
          }}
        />

        {/* End cap glow dot */}
        {animatedScore > 0 && (() => {
          const endAngle = ((animatedScore / 100) * 360 - 90) * (Math.PI / 180);
          const dotX = center + radius * Math.cos(endAngle);
          const dotY = center + radius * Math.sin(endAngle);
          return (
            <circle
              cx={dotX}
              cy={dotY}
              r={4}
              fill={primaryColor}
              style={{
                filter: ghostMode ? 'none' : `drop-shadow(0 0 6px ${primaryColor})`,
                transition: 'cx 1.5s cubic-bezier(0.4, 0, 0.2, 1), cy 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          );
        })()}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-3xl font-mono font-bold tabular-nums"
          style={{
            color: primaryColor,
            textShadow: ghostMode ? 'none' : `0 0 15px rgba(0,255,204,0.4), 0 0 40px rgba(0,255,204,0.15)`,
          }}
        >
          {animatedScore}%
        </motion.span>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-[9px] font-mono uppercase tracking-[0.2em] mt-1"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(0,255,204,0.45)' }}
        >
          {getLabel(animatedScore)}
        </motion.span>
      </div>
    </div>
  );
}

export default SystemRecoveryRing;
