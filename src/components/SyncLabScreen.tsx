import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Types ── */
interface SyncLabScreenProps {
  onContinue: () => void;
  onBack: () => void;
}

interface HealthProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permissions: string[];
}

/* ── Apple Health Icon ── */
function AppleHealthIcon({ active }: { active: boolean }) {
  const color = active ? '#FF375F' : 'rgba(255,255,255,0.25)';
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="8" fill={active ? 'rgba(255,55,95,0.12)' : 'rgba(255,255,255,0.03)'} stroke={active ? 'rgba(255,55,95,0.3)' : 'rgba(255,255,255,0.06)'} strokeWidth="1" />
      <path d="M20 12c-1.5-2.5-4-3-5.5-2.5s-3 2.5-2.5 5c.5 3 3 6 8 10 5-4 7.5-7 8-10 .5-2.5-1-4.5-2.5-5s-4 0-5.5 2.5z" fill={color} opacity={active ? 0.9 : 0.4} />
      {active && <path d="M20 12c-1.5-2.5-4-3-5.5-2.5s-3 2.5-2.5 5c.5 3 3 6 8 10 5-4 7.5-7 8-10 .5-2.5-1-4.5-2.5-5s-4 0-5.5 2.5z" fill="#FF375F" opacity="0.15" filter="url(#appleGlow)" />}
      <defs>
        <filter id="appleGlow" x="6" y="4" width="28" height="28" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
    </svg>
  );
}

/* ── Google Fit Icon ── */
function GoogleFitIcon({ active }: { active: boolean }) {
  const color = active ? '#4285F4' : 'rgba(255,255,255,0.25)';
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <rect x="4" y="4" width="32" height="32" rx="8" fill={active ? 'rgba(66,133,244,0.12)' : 'rgba(255,255,255,0.03)'} stroke={active ? 'rgba(66,133,244,0.3)' : 'rgba(255,255,255,0.06)'} strokeWidth="1" />
      {/* Heart-rate style path */}
      <path d="M12 22h4l2-4 3 8 2-6 2 2h3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={active ? 0.9 : 0.4} />
      <circle cx="20" cy="15" r="3" stroke={color} strokeWidth="1.5" fill="none" opacity={active ? 0.7 : 0.3} />
      {active && <circle cx="20" cy="20" r="10" fill="#4285F4" opacity="0.08" filter="url(#fitGlow)" />}
      <defs>
        <filter id="fitGlow" x="4" y="4" width="32" height="32" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
    </svg>
  );
}

/* ── Lock Icon ── */
function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="rgba(0,240,255,0.5)" strokeWidth="1" fill="rgba(0,240,255,0.05)" />
      <path d="M5 6V4.5a2 2 0 0 1 4 0V6" stroke="rgba(0,240,255,0.5)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="7" cy="9.5" r="0.8" fill="rgba(0,240,255,0.6)" />
    </svg>
  );
}

/* ── Shield Icon ── */
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L2.5 4v4c0 3.5 2.5 6 5.5 7 3-1 5.5-3.5 5.5-7V4L8 1.5z" stroke="rgba(0,240,255,0.4)" strokeWidth="1" fill="rgba(0,240,255,0.04)" />
      <path d="M6 8l1.5 1.5L10.5 6" stroke="rgba(0,240,255,0.6)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Fingerprint Scanner Animation ── */
function FingerprintScanner({ active }: { active: boolean }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mx-auto">
      {/* Fingerprint arcs */}
      {[12, 15, 18, 21].map((r, i) => (
        <path
          key={i}
          d={`M${24 - r * 0.6} ${24 + r * 0.3} A${r} ${r} 0 0 1 ${24 + r * 0.6} ${24 + r * 0.3}`}
          stroke={active ? '#00F0FF' : 'rgba(255,255,255,0.08)'}
          strokeWidth="1"
          strokeLinecap="round"
          opacity={active ? 0.3 + i * 0.15 : 0.15}
          strokeDasharray={active ? 'none' : '3 4'}
        />
      ))}
      {/* Center dot */}
      <circle cx="24" cy="24" r="2" fill={active ? '#00F0FF' : 'rgba(255,255,255,0.1)'} opacity={active ? 0.8 : 0.3} />
      {active && (
        <>
          <circle cx="24" cy="24" r="6" fill="#00F0FF" opacity="0.1">
            <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.03;0.15" dur="2s" repeatCount="indefinite" />
          </circle>
          {/* Scan line */}
          <line x1="10" x2="38" stroke="#00F0FF" strokeWidth="0.5" opacity="0.4">
            <animate attributeName="y1" values="14;34;14" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="y2" values="14;34;14" dur="2.5s" repeatCount="indefinite" />
          </line>
        </>
      )}
    </svg>
  );
}

const providers: HealthProvider[] = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    description: 'Heart rate, HRV, sleep, activity, blood oxygen',
    icon: <AppleHealthIcon active={false} />,
    color: '#FF375F',
    permissions: ['Heart Rate', 'HRV', 'Sleep Analysis', 'Steps', 'Blood Oxygen'],
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    description: 'Activity, heart rate, sleep, body metrics',
    icon: <GoogleFitIcon active={false} />,
    color: '#4285F4',
    permissions: ['Activity', 'Heart Rate', 'Sleep', 'Body Metrics', 'Nutrition'],
  },
];

export function SyncLabScreen({ onContinue, onBack }: SyncLabScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncComplete, setSyncComplete] = useState<Record<string, boolean>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleConnect = (providerId: string) => {
    if (connected[providerId]) {
      // Disconnect
      setConnected(prev => ({ ...prev, [providerId]: false }));
      setSyncComplete(prev => ({ ...prev, [providerId]: false }));
      return;
    }
    // Simulate connection + sync
    setConnected(prev => ({ ...prev, [providerId]: true }));
    setSyncing(providerId);
    setTimeout(() => {
      setSyncing(null);
      setSyncComplete(prev => ({ ...prev, [providerId]: true }));
    }, 2200);
  };

  const anyConnected = Object.values(connected).some(Boolean);
  const anySyncing = syncing !== null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : 40 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-md flex flex-col items-center gap-6 relative z-10"
    >
      {/* Header with fingerprint */}
      <div className="flex flex-col items-center gap-4 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <FingerprintScanner active={anyConnected} />
        </motion.div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <ShieldIcon />
            <span
              className="text-[9px] font-mono uppercase tracking-[0.2em]"
              style={{ color: 'rgba(0,240,255,0.5)' }}
            >
              Private by default
            </span>
            <ShieldIcon />
          </div>

          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: 'rgba(255,255,255,0.92)' }}
          >
            Calibrating your Bio-Vault
          </h1>

          <p
            className="text-[12px] leading-relaxed max-w-xs"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            Wearable sync is coming later. Prefer Manual Vitals or paste labs into Bio-Vault.
            Your account data is private — we do not claim end-to-end encryption or HIPAA certification.
          </p>
        </div>
      </div>

      {/* Privacy Banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 8 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{
          background: 'rgba(0,240,255,0.03)',
          border: '1px solid rgba(0,240,255,0.08)',
        }}
      >
        <LockIcon />
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-medium" style={{ color: 'rgba(0,240,255,0.7)' }}>
            Privacy &amp; Security
          </span>
          <span className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Prototype privacy: account-scoped storage on Convex. Not on-device-only,
            not differential privacy, and not HIPAA certified. Not medical advice.
          </span>
        </div>
      </motion.div>

      {/* Provider Cards */}
      <div className="w-full flex flex-col gap-3">
        {providers.map((provider, idx) => {
          const isConnected = connected[provider.id];
          const isSyncing = syncing === provider.id;
          const isSynced = syncComplete[provider.id];
          const isExpanded = expandedProvider === provider.id;

          return (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 16 }}
              transition={{ duration: 0.5, delay: 0.25 + idx * 0.1 }}
              className="w-full rounded-2xl overflow-hidden transition-all duration-300"
              style={{
                background: isConnected
                  ? `rgba(${provider.color === '#FF375F' ? '255,55,95' : '66,133,244'},0.04)`
                  : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isConnected ? `${provider.color}30` : 'rgba(255,255,255,0.06)'}`,
                boxShadow: isSynced ? `0 0 20px ${provider.color}10` : 'none',
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 p-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {provider.id === 'apple_health'
                    ? <AppleHealthIcon active={isConnected} />
                    : <GoogleFitIcon active={isConnected} />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] font-semibold tracking-tight"
                      style={{ color: isConnected ? provider.color : 'rgba(255,255,255,0.7)' }}
                    >
                      {provider.name}
                    </span>
                    {isSynced && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `${provider.color}15`,
                          color: provider.color,
                          border: `1px solid ${provider.color}25`,
                        }}
                      >
                        Synced
                      </motion.span>
                    )}
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {provider.description}
                  </p>
                </div>

                {/* Connect button */}
                <button
                  onClick={() => handleConnect(provider.id)}
                  disabled={isSyncing}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-300"
                  style={{
                    background: isConnected
                      ? isSyncing ? `${provider.color}15` : `${provider.color}12`
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isConnected ? `${provider.color}30` : 'rgba(255,255,255,0.08)'}`,
                    color: isConnected ? provider.color : 'rgba(255,255,255,0.5)',
                    opacity: isSyncing ? 0.7 : 1,
                    cursor: isSyncing ? 'wait' : 'pointer',
                  }}
                >
                  {isSyncing ? (
                    <span className="flex items-center gap-1.5">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="inline-block w-3 h-3 border-[1.5px] border-t-transparent rounded-full"
                        style={{ borderColor: `${provider.color}60`, borderTopColor: 'transparent' }}
                      />
                      Syncing
                    </span>
                  ) : isConnected ? 'Connected' : 'Connect'}
                </button>
              </div>

              {/* Permissions toggle */}
              {isConnected && (
                <div className="px-4 pb-1">
                  <button
                    onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                    className="text-[9px] font-mono uppercase tracking-wider transition-colors duration-200"
                    style={{ color: 'rgba(255,255,255,0.2)' }}
                  >
                    {isExpanded ? 'Hide permissions \u25B2' : 'View permissions \u25BC'}
                  </button>
                </div>
              )}

              {/* Expanded permissions */}
              <AnimatePresence>
                {isExpanded && isConnected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {provider.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-1 rounded-md text-[9px] font-mono tracking-wide"
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.4)',
                          }}
                        >
                          \u2713 {perm}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sync progress bar */}
              {isSyncing && (
                <div className="px-4 pb-3">
                  <div
                    className="w-full h-0.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2, ease: 'easeInOut' }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${provider.color}60, ${provider.color})`,
                        boxShadow: `0 0 8px ${provider.color}40`,
                      }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Data categories preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mounted ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="w-full"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <span className="text-[9px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Bio-Vault Data Channels
          </span>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Cardiac', icon: '\u2764\uFE0F', desc: 'HR, HRV, BP' },
            { label: 'Sleep', icon: '\uD83C\uDF19', desc: 'Stages, Duration' },
            { label: 'Metabolic', icon: '\uD83D\uDD25', desc: 'Calories, BMR' },
          ].map((cat) => (
            <div
              key={cat.label}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
              style={{
                background: anyConnected ? 'rgba(0,240,255,0.03)' : 'rgba(255,255,255,0.015)',
                border: `1px solid ${anyConnected ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              <span className="text-sm">{cat.icon}</span>
              <span className="text-[10px] font-semibold" style={{ color: anyConnected ? 'rgba(0,240,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                {cat.label}
              </span>
              <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {cat.desc}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Continue / Skip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: mounted ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="w-full flex flex-col items-center gap-3 pt-2"
      >
        <button
          onClick={onContinue}
          disabled={anySyncing}
          className="w-full py-3.5 rounded-xl text-[13px] font-semibold tracking-wide uppercase transition-all duration-300 relative overflow-hidden"
          style={{
            background: anyConnected ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${anyConnected ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
            color: anyConnected ? '#00F0FF' : 'rgba(255,255,255,0.3)',
            boxShadow: anyConnected ? '0 0 20px rgba(0,240,255,0.1)' : 'none',
            cursor: anySyncing ? 'wait' : 'pointer',
            opacity: anySyncing ? 0.6 : 1,
          }}
        >
          {anyConnected ? 'Continue' : 'Continue Without Syncing'}
        </button>

        <button
          onClick={onBack}
          className="text-[11px] font-mono tracking-wider transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}
        >
          Back
        </button>
      </motion.div>
    </motion.div>
  );
}
