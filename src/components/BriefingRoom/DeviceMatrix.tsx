import { useState, useEffect } from 'react';

/* ══════════════════════════════════════════════════════════════ */
/*  DEVICE MATRIX — High-Performance Bio-Hacking Uplink Grid    */
/* ══════════════════════════════════════════════════════════════ */

interface Device {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  brandColor: string;
  status: 'offline' | 'offline' | 'syncing';
  lastSync?: string;
  dataPoints?: number;
  signalStrength?: number; // 0-100
}

const DEVICES = [
  {
    id: 'apple-health',
    name: 'Apple Health',
    subtitle: 'HealthKit API',
    brandColor: '#FF2D55',
    status: 'offline',
    lastSync: '—',
    dataPoints: 0,
    signalStrength: 0,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#FF2D55" opacity="0.9"/>
      </svg>
    ),
  },
  {
    id: 'google-fit',
    name: 'Google Fit',
    subtitle: 'Fitness API v2',
    brandColor: '#4285F4',
    status: 'offline',
    lastSync: '—',
    dataPoints: 0,
    signalStrength: 0,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L6 8l6 6 6-6-6-6z" fill="#4285F4" opacity="0.9"/>
        <path d="M6 8l-4 4 4 4 6-6-6-6z" fill="#EA4335" opacity="0.8"/>
        <path d="M18 8l-6 6 4 4 6-6-4-4z" fill="#34A853" opacity="0.8"/>
        <path d="M12 14l-4 4 4 4 4-4-4-4z" fill="#FBBC05" opacity="0.8"/>
      </svg>
    ),
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    subtitle: 'Gen 4 · Cloud API',
    brandColor: '#D4AF37',
    status: 'offline',
    lastSync: '—',
    dataPoints: 0,
    signalStrength: 0,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#D4AF37" strokeWidth="2.5" fill="none" opacity="0.9"/>
        <circle cx="12" cy="12" r="4" stroke="#D4AF37" strokeWidth="1.5" fill="none" opacity="0.5"/>
        <circle cx="12" cy="5" r="1" fill="#D4AF37" opacity="0.7"/>
      </svg>
    ),
  },
  {
    id: 'eight-sleep',
    name: 'Eight Sleep',
    subtitle: 'Pod 4 Ultra',
    brandColor: '#00D4AA',
    status: 'offline',
    lastSync: '—',
    dataPoints: 0,
    signalStrength: 0,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9"/>
        <path d="M12 8v4l2 2" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      </svg>
    ),
  },
  {
    id: 'peloton',
    name: 'Peloton',
    subtitle: 'Bike+ · Tread',
    brandColor: '#FF0000',
    status: 'offline',
    lastSync: '—',
    dataPoints: 0,
    signalStrength: 0,
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#FF0000" strokeWidth="2" fill="none" opacity="0.8"/>
        <polygon points="10,8 16,12 10,16" fill="#FF0000" opacity="0.9"/>
      </svg>
    ),
  },
] as Device[];

/* ── Signal Strength Bar ── */
function SignalBar({ strength, color }: { strength: number; color: string }) {
  const bars = 5;
  const active = Math.round((strength / 100) * bars);
  return (
    <div className="flex items-end gap-[2px] h-3">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="rounded-[1px] transition-all duration-500"
          style={{
            width: 3,
            height: 4 + i * 2,
            background: i < active ? color : 'rgba(255,255,255,0.06)',
            boxShadow: i < active ? `0 0 4px ${color}44` : 'none',
            opacity: i < active ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

/* ── Status Badge ── */
function StatusBadge({ status, color }: { status: Device['status']; color: string }) {
  const configs = {
    connected: { label: 'CONNECTED', bg: `${color}15`, border: `${color}30`, textColor: color, dot: color },
    syncing: { label: 'SYNCING', bg: 'rgba(255,184,107,0.08)', border: 'rgba(255,184,107,0.2)', textColor: '#FFB86B', dot: '#FFB86B' },
    offline: { label: 'COMING LATER', bg: 'rgba(255,184,107,0.06)', border: 'rgba(255,184,107,0.15)', textColor: 'rgba(255,184,107,0.7)', dot: 'rgba(255,184,107,0.5)' },
  };
  const c = configs[status];
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="relative w-1.5 h-1.5">
        {status === 'syncing' && (
          <div className="absolute inset-0 rounded-full" style={{ background: c.dot, opacity: 0.4, animation: 'statusDotPulse 1.5s ease-in-out infinite' }} />
        )}
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot, boxShadow: (status as string) === 'connected' ? `0 0 6px ${c.dot}` : 'none' }} />
      </div>
      <span className="text-[8px] font-mono font-bold tracking-[0.1em]" style={{ color: c.textColor }}>{c.label}</span>
    </div>
  );
}

/* ── Device Card ── */
function DeviceCard({ device, index }: { device: Device; index: number }) {
  const [hovered, setHovered] = useState(false);
  const isActive = device.status !== 'offline';

  return (
    <div
      className="relative overflow-hidden rounded-xl border transition-all duration-300 cursor-default"
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${device.brandColor}08, rgba(10,10,11,0.8))`
          : 'rgba(10,10,11,0.6)',
        borderColor: hovered
          ? `${device.brandColor}25`
          : isActive ? `${device.brandColor}10` : 'rgba(255,255,255,0.03)',
        boxShadow: hovered
          ? `0 4px 24px rgba(0,0,0,0.3), 0 0 20px ${device.brandColor}08`
          : '0 2px 8px rgba(0,0,0,0.2)',
        animation: `cardSlideUp 0.4s ease both ${0.05 * index}s`,
        opacity: isActive ? 1 : 0.55,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top glow accent */}
      {isActive && (
        <div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${device.brandColor}40, transparent)`,
            opacity: hovered ? 1 : 0.5,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      <div className="p-4">
        {/* Header row: icon + signal */}
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              background: isActive ? `${device.brandColor}10` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isActive ? `${device.brandColor}15` : 'rgba(255,255,255,0.04)'}`,
              boxShadow: isActive && hovered ? `0 0 16px ${device.brandColor}15` : 'none',
              filter: !isActive ? 'grayscale(0.8)' : 'none',
            }}
          >
            {device.icon}
          </div>
          <SignalBar strength={device.signalStrength ?? 0} color={isActive ? device.brandColor : 'rgba(255,255,255,0.1)'} />
        </div>

        {/* Name + subtitle */}
        <div className="mb-2.5">
          <h3 className="text-[13px] font-semibold tracking-wide" style={{ color: isActive ? '#E8E0D8' : 'rgba(255,255,255,0.3)' }}>
            {device.name}
          </h3>
          <p className="text-[9px] font-mono tracking-wider mt-0.5" style={{ color: isActive ? `${device.brandColor}88` : 'rgba(255,255,255,0.12)' }}>
            {device.subtitle}
          </p>
        </div>

        {/* Status badge */}
        <StatusBadge status={device.status} color={device.brandColor} />

        {/* Metrics row */}
        <div className="flex items-center justify-between mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div>
            <span className="text-[8px] font-mono tracking-wider block" style={{ color: 'rgba(255,255,255,0.2)' }}>DATA POINTS</span>
            <span className="text-[12px] font-mono font-bold tabular-nums" style={{ color: isActive ? device.brandColor : 'rgba(255,255,255,0.15)', filter: isActive ? `drop-shadow(0 0 4px ${device.brandColor}33)` : 'none' }}>
              {(device.dataPoints ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[8px] font-mono tracking-wider block" style={{ color: 'rgba(255,255,255,0.2)' }}>LAST SYNC</span>
            <span className="text-[10px] font-mono" style={{ color: isActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)' }}>
              {device.lastSync}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  DEVICE MATRIX EXPORT                                         */
/* ══════════════════════════════════════════════════════════════ */

export function DeviceMatrix() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const connectedCount = 0; // wearables not live
  const totalDataPoints = DEVICES.reduce((sum, d) => sum + (d.dataPoints ?? 0), 0);
  const hasUnsynced = DEVICES.some(d => d.status === 'offline');

  return (
    <div
      className="px-1"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Matrix Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,240,255,0.08), rgba(175,130,255,0.06))',
              border: '1px solid rgba(0,240,255,0.12)',
              boxShadow: '0 0 12px rgba(0,240,255,0.06)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="rgba(175,130,255,0.6)" strokeWidth="1.5" />
            </svg>
          </div>
          <div>
            <h2 className="text-[15px] font-bold tracking-wide" style={{ color: '#E8E0D8' }}>Device Matrix</h2>
            <p className="text-[9px] font-mono tracking-[0.1em]" style={{ color: 'rgba(0,240,255,0.4)' }}>UPLINK STATUS · NOT LIVE YET</p>
          </div>
        </div>

        {/* Aggregate stats bar */}
        <div
          className="flex items-center gap-4 px-3 py-2 rounded-lg mt-3"
          style={{
            background: 'rgba(0,240,255,0.02)',
            border: '1px solid rgba(0,240,255,0.06)',
          }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FFB86B' }} />
            <span className="text-[9px] font-mono font-bold" style={{ color: '#FFB86B' }}>0/{DEVICES.length}</span>
            <span className="text-[8px] font-mono tracking-wider" style={{ color: 'rgba(255,184,107,0.5)' }}>COMING LATER</span>
          </div>
          <div className="w-px h-3" style={{ background: 'rgba(0,240,255,0.08)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: '#AF82FF', filter: 'drop-shadow(0 0 4px rgba(175,130,255,0.3))' }}>{totalDataPoints.toLocaleString()}</span>
            <span className="text-[8px] font-mono tracking-wider" style={{ color: 'rgba(0,240,255,0.3)' }}>DATA POINTS</span>
          </div>
          <div className="w-px h-3" style={{ background: 'rgba(0,240,255,0.08)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono" style={{ color: 'rgba(0,240,255,0.5)' }}>LATENCY</span>
            <span className="text-[9px] font-mono font-bold" style={{ color: '#7CB68E' }}>12ms</span>
          </div>
        </div>
      </div>

      {/* ── Device Grid ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {DEVICES.map((device, i) => (
          <DeviceCard key={device.id} device={device} index={i} />
        ))}
      </div>

      {/* ── Initialize Uplink CTA (if any device offline) ── */}
      {hasUnsynced && (
        <div
          className="relative overflow-hidden rounded-xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(255,0,0,0.04), rgba(255,107,107,0.02), rgba(10,10,11,0.8))',
            border: '1px solid rgba(255,107,107,0.15)',
            boxShadow: '0 0 30px rgba(255,0,0,0.04)',
            animation: 'cardSlideUp 0.5s ease both 0.3s',
          }}
        >
          {/* Scanning line animation */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{
              background: 'linear-gradient(90deg, transparent, #FF6B6B, transparent)',
              animation: 'scanLine 3s ease-in-out infinite',
            }}
          />

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(255,107,107,0.08)',
                border: '1px solid rgba(255,107,107,0.15)',
                boxShadow: '0 0 16px rgba(255,107,107,0.08)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[12px] font-bold tracking-wide" style={{ color: '#FFB86B' }}>Wearable sync coming later</h3>
              <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(255,184,107,0.55)' }}>
                Use Manual Vitals (Settings → Connections or Cmd+K → Quick Log)
              </p>
            </div>
          </div>

          <button
            className="w-full mt-3 py-2.5 rounded-lg font-mono text-[11px] font-bold tracking-[0.15em] uppercase transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,107,107,0.15), rgba(255,60,60,0.1))',
              border: '1px solid rgba(255,107,107,0.3)',
              color: '#FF6B6B',
              boxShadow: '0 0 20px rgba(255,107,107,0.08), inset 0 1px 0 rgba(255,255,255,0.03)',
              textShadow: '0 0 10px rgba(255,107,107,0.4)',
            }}
          >
            Manual vitals available now
          </button>
        </div>
      )}

      {/* ── Scan line keyframe ── */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { transform: translateX(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          50% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export default DeviceMatrix;
