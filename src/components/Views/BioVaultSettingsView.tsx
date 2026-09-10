import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';

/* ─── Warm Palette ─── */
const W = {
  bg: 'rgba(26,24,22,0.7)',
  bgLight: 'rgba(26,24,22,0.4)',
  border: 'rgba(168,155,138,0.12)',
  borderActive: 'rgba(168,155,138,0.25)',
  text: 'rgba(245,240,235,0.9)',
  textMuted: 'rgba(200,190,178,0.6)',
  textFaint: 'rgba(200,190,178,0.35)',
  sage: '#7CB68E',
  sageBg: 'rgba(124,182,142,0.08)',
  sageBorder: 'rgba(124,182,142,0.2)',
  terra: '#E8976C',
  terraBg: 'rgba(232,151,108,0.08)',
  terraBorder: 'rgba(232,151,108,0.2)',
  gold: '#C4A46C',
  goldBg: 'rgba(196,164,108,0.08)',
  goldBorder: 'rgba(196,164,108,0.2)',
  sky: '#6BA3BE',
  skyBg: 'rgba(107,163,190,0.08)',
  skyBorder: 'rgba(107,163,190,0.2)',
  rose: '#D4847A',
  roseBg: 'rgba(212,132,122,0.08)',
  roseBorder: 'rgba(212,132,122,0.2)',
  lavender: '#B08EC6',
  lavenderBg: 'rgba(176,142,198,0.08)',
  lavenderBorder: 'rgba(176,142,198,0.2)',
  teal: '#00FFCC',
  tealBg: 'rgba(0,255,204,0.06)',
  tealBorder: 'rgba(0,255,204,0.15)',
};

function timeAgo(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/* ─── Grade Ring ─── */
const GradeRing = React.memo(({ grade, color, score }: { grade: string; color: string; score: number }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[36px] font-bold font-serif" style={{ color, lineHeight: 1 }}>{grade}</span>
        <span className="text-[11px] font-semibold mt-1" style={{ color: W.textMuted }}>{score}%</span>
      </div>
    </div>
  );
});
GradeRing.displayName = 'GradeRing';

/* ─── Module Status Card ─── */
const ModuleCard = React.memo(({ mod }: { mod: any }) => {
  const statusConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
    active: { color: W.sage, bg: W.sageBg, border: W.sageBorder, label: 'Active' },
    partial: { color: W.gold, bg: W.goldBg, border: W.goldBorder, label: 'Partial' },
    inactive: { color: W.rose, bg: W.roseBg, border: W.roseBorder, label: 'Inactive' },
  };
  const s = statusConfig[mod.status] || statusConfig.inactive;

  return (
    <div className="rounded-2xl p-4 transition-all duration-300" style={{ background: W.bg, border: `1px solid ${W.border}` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{mod.icon}</span>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: W.text }}>{mod.label}</div>
            <div className="text-[11px] mt-0.5" style={{ color: W.textFaint }}>{mod.detail}</div>
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
        >
          {s.label}
        </span>
      </div>
      {/* Coverage bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${mod.coverage}%`, background: s.color, boxShadow: `0 0 8px ${s.color}30` }}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px]" style={{ color: W.textFaint }}>
          {mod.coverage}% coverage
        </span>
        <span className="text-[10px]" style={{ color: W.textFaint }}>
          Last sync: {timeAgo(mod.lastSync)}
        </span>
      </div>
    </div>
  );
});
ModuleCard.displayName = 'ModuleCard';

/* ─── Privacy Toggle ─── */
const PrivacyToggle = React.memo(({ label, description, enabled, onToggle }: {
  label: string; description: string; enabled: boolean; onToggle: () => void;
}) => (
  <div
    className="flex items-center justify-between p-4 rounded-2xl transition-all duration-200"
    style={{ background: W.bg, border: `1px solid ${W.border}` }}
  >
    <div className="flex-1 mr-4">
      <div className="text-[13px] font-semibold" style={{ color: W.text }}>{label}</div>
      <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: W.textFaint }}>{description}</div>
    </div>
    <button
      onClick={onToggle}
      className="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0"
      style={{
        background: enabled ? W.sageBg : 'rgba(255,255,255,0.04)',
        border: `1px solid ${enabled ? W.sageBorder : W.border}`,
      }}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300"
        style={{
          left: enabled ? 20 : 2,
          background: enabled ? W.sage : 'rgba(255,255,255,0.2)',
          boxShadow: enabled ? `0 0 8px ${W.sage}40` : 'none',
        }}
      />
    </button>
  </div>
));
PrivacyToggle.displayName = 'PrivacyToggle';

/* ─── Share Progress Snapshot ─── */
const ShareSnapshot = React.memo(({ healthReport, viveAge }: { healthReport: any; viveAge: any }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setGenerating(true);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 600, h = 400;
    canvas.width = w * 2;
    canvas.height = h * 2;
    ctx.scale(2, 2);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0A0A0B');
    bgGrad.addColorStop(1, '#111110');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Top accent line
    const accentGrad = ctx.createLinearGradient(0, 0, w, 0);
    accentGrad.addColorStop(0, 'rgba(0,255,204,0)');
    accentGrad.addColorStop(0.3, 'rgba(0,255,204,0.6)');
    accentGrad.addColorStop(0.7, 'rgba(0,255,204,0.6)');
    accentGrad.addColorStop(1, 'rgba(0,255,204,0)');
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, 0, w, 2);

    // Title
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.letterSpacing = '3px';
    ctx.fillText('VIVE 4.0 — LONGEVITY SCORE', 32, 40);

    // Grade circle
    const gradeColor = healthReport?.gradeColor || '#00FFCC';
    const grade = healthReport?.grade || '—';
    const score = healthReport?.healthScore || 0;

    ctx.beginPath();
    ctx.arc(80, 120, 44, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(80, 120, 44, -Math.PI / 2, -Math.PI / 2 + (score / 100) * Math.PI * 2);
    ctx.strokeStyle = gradeColor;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.font = 'bold 32px Georgia, serif';
    ctx.fillStyle = gradeColor;
    ctx.textAlign = 'center';
    ctx.fillText(grade, 80, 130);
    ctx.font = '11px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(`${score}% Health`, 80, 148);
    ctx.textAlign = 'left';

    // Metrics (redacted sensitive values)
    const metrics = [
      { label: 'BIOLOGICAL AGE', value: viveAge ? `${viveAge.viveAge}y` : '••••', redacted: false },
      { label: 'SYSTEM STABILITY', value: healthReport ? `${healthReport.healthScore}%` : '••••', redacted: false },
      { label: 'ACTIVE MODULES', value: healthReport ? `${healthReport.summary.activeModules}/${healthReport.summary.totalModules}` : '••••', redacted: false },
      { label: 'PROTOCOL ADHERENCE', value: healthReport?.adherence?.avg7d != null ? `${healthReport.adherence.avg7d}%` : '••••', redacted: false },
      { label: 'BLOOD MARKERS', value: '●●●●●●', redacted: true },
      { label: 'GENETIC DATA', value: '●●●●●●', redacted: true },
    ];

    let my = 80;
    metrics.forEach((m, i) => {
      const mx = 180 + (i % 2) * 200;
      const mmy = my + Math.floor(i / 2) * 56;

      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(m.label, mx, mmy);

      ctx.font = m.redacted ? '16px system-ui' : 'bold 22px Georgia, serif';
      ctx.fillStyle = m.redacted ? 'rgba(255,255,255,0.12)' : 'rgba(245,240,235,0.85)';
      ctx.fillText(m.value, mx, mmy + 22);
    });

    // Module bars
    const modules = healthReport?.modules || [];
    let barY = 270;
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillText('DATA MODULES', 32, barY);
    barY += 16;

    modules.forEach((mod: any, i: number) => {
      const bx = 32;
      const bw = w - 64;
      const by = barY + i * 14;

      ctx.font = '9px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(`${mod.icon} ${mod.label}`, bx, by + 8);

      // Bar bg
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.roundRect(bx + 160, by, bw - 200, 8, 4);
      ctx.fill();

      // Bar fill
      const barColor = mod.status === 'active' ? '#7CB68E' : mod.status === 'partial' ? '#C4A46C' : '#D4847A';
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(bx + 160, by, Math.max(2, ((bw - 200) * mod.coverage) / 100), 8, 4);
      ctx.fill();

      ctx.font = '8px system-ui';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'right';
      ctx.fillText(`${mod.coverage}%`, bx + bw - 16, by + 8);
      ctx.textAlign = 'left';
    });

    // Footer
    ctx.font = '9px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('Sensitive biomarkers redacted for privacy', 32, h - 20);
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), w - 32, h - 20);
    ctx.textAlign = 'left';

    // Bottom accent
    ctx.fillStyle = accentGrad;
    ctx.fillRect(0, h - 2, w, 2);

    const url = canvas.toDataURL('image/png');
    setPreviewUrl(url);
    setGenerating(false);
  }, [healthReport, viveAge]);

  const handleDownload = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `vive-longevity-score-${Date.now()}.png`;
    a.click();
  }, [previewUrl]);

  const handleCopyToClipboard = useCallback(async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvasRef.current!.toBlob(resolve, 'image/png'));
      if (blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      handleDownload();
    }
  }, [handleDownload]);

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {previewUrl ? (
        <div className="space-y-3">
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${W.border}` }}>
            <img src={previewUrl} alt="Longevity Score Snapshot" className="w-full" style={{ imageRendering: 'auto' }} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-[0.98]"
              style={{ background: W.sageBg, border: `1px solid ${W.sageBorder}`, color: W.sage }}
            >
              💾 Download
            </button>
            <button
              onClick={handleCopyToClipboard}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-[0.98]"
              style={{ background: copied ? W.tealBg : W.skyBg, border: `1px solid ${copied ? W.tealBorder : W.skyBorder}`, color: copied ? W.teal : W.sky }}
            >
              {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
            </button>
          </div>
          <button
            onClick={() => setPreviewUrl(null)}
            className="w-full py-2.5 rounded-xl text-[12px] font-medium transition-all duration-200"
            style={{ color: W.textFaint, background: W.bgLight, border: `1px solid ${W.border}` }}
          >
            Generate New Snapshot
          </button>
        </div>
      ) : (
        <button
          onClick={generateSnapshot}
          disabled={generating}
          className="w-full py-4 rounded-2xl text-[14px] font-bold transition-all duration-300 active:scale-[0.98]"
          style={{
            background: generating ? W.bgLight : `linear-gradient(135deg, ${W.tealBg}, ${W.skyBg})`,
            border: `1px solid ${generating ? W.border : W.tealBorder}`,
            color: generating ? W.textFaint : W.teal,
            boxShadow: generating ? 'none' : `0 4px 20px rgba(0,255,204,0.1)`,
          }}
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: W.teal, borderTopColor: 'transparent' }} />
              Generating...
            </span>
          ) : (
            <>📸 Generate Shareable Snapshot</>
          )}
        </button>
      )}

      <div className="text-center">
        <span className="text-[11px]" style={{ color: W.textFaint }}>
          🔒 Blood markers & genetic data are automatically redacted
        </span>
      </div>
    </div>
  );
});
ShareSnapshot.displayName = 'ShareSnapshot';

/* ═══════════════════════════════════════════════════════════════
   BioVaultSettingsView — Privacy + System Health + Share
   ═══════════════════════════════════════════════════════════════ */
const BioVaultSettingsView = () => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'health' | 'privacy' | 'share'>('health');

  // Privacy toggles (local state — would persist to Convex in production)
  const [privacySettings, setPrivacySettings] = useState({
    encryptAtRest: true,
    anonymizeExports: true,
    shareWithSquad: false,
    allowAIAnalysis: true,
    autoDeleteAfter90d: false,
    hideFromLeaderboard: false,
  });

  useEffect(() => { setMounted(true); }, []);

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';

  const healthReport = useQuery(api.systemHealth.getSystemHealthReport, sessionId ? { sessionId } : 'skip');
  const viveAge = useQuery(api.bioAgeAlgorithm.computeViveAge, sessionId ? { sessionId } : 'skip');

  const togglePrivacy = useCallback((key: keyof typeof privacySettings) => {
    setPrivacySettings(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const tabs = [
    { id: 'health' as const, label: 'System Health', icon: '🔬' },
    { id: 'privacy' as const, label: 'Privacy', icon: '🔒' },
    { id: 'share' as const, label: 'Share Progress', icon: '📸' },
  ];

  return (
    <div
      className="font-sans px-4 pb-8 max-w-[800px] mx-auto"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Header */}
      <div className="mb-5 pt-2">
        <h2 className="text-[24px] font-bold" style={{ color: W.text, letterSpacing: '-0.02em' }}>
          Bio-Vault Settings
        </h2>
        <p className="text-[13px] mt-1" style={{ color: W.textMuted }}>
          System diagnostics, privacy controls & progress sharing
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all duration-200"
            style={{
              background: activeTab === tab.id ? W.tealBg : 'transparent',
              border: `1px solid ${activeTab === tab.id ? W.tealBorder : W.border}`,
              color: activeTab === tab.id ? W.teal : W.textFaint,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── System Health Tab ── */}
      {activeTab === 'health' && (
        <div style={{ animation: 'settingsFadeIn 0.4s ease both' }}>
          {/* Grade Overview */}
          <div
            className="rounded-2xl p-6 mb-5 flex items-center gap-6"
            style={{ background: W.bg, border: `1px solid ${W.border}` }}
          >
            <GradeRing
              grade={healthReport?.grade || '—'}
              color={healthReport?.gradeColor || W.textFaint}
              score={healthReport?.healthScore || 0}
            />
            <div className="flex-1">
              <div className="text-[18px] font-bold" style={{ color: W.text }}>
                Account Health
              </div>
              <div className="text-[12px] mt-1 leading-relaxed" style={{ color: W.textMuted }}>
                {healthReport ? (
                  <>
                    {healthReport.summary.activeModules} active, {healthReport.summary.partialModules} partial, {healthReport.summary.inactiveModules} inactive modules
                  </>
                ) : 'Loading system diagnostics...'}
              </div>
              {/* Quick stats */}
              <div className="flex gap-3 mt-3">
                {[
                  { label: 'Files', value: healthReport?.storage.totalFiles ?? 0, icon: '📄' },
                  { label: 'Storage', value: healthReport ? formatBytes(healthReport.storage.totalBytes) : '—', icon: '💾' },
                  { label: 'Encrypted', value: healthReport ? `${healthReport.storage.encryptionRate}%` : '—', icon: '🔐' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="text-sm">{s.icon}</span>
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: W.text }}>{s.value}</div>
                      <div className="text-[9px]" style={{ color: W.textFaint }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Module Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="text-lg">📡</span>
              <h3 className="text-[15px] font-bold" style={{ color: W.text }}>Data Modules</h3>
            </div>
            {healthReport?.modules.map((mod: any) => (
              <ModuleCard key={mod.id} mod={mod} />
            )) || (
              <div className="rounded-2xl p-8 text-center" style={{ background: W.bg, border: `1px solid ${W.border}` }}>
                <div className="text-3xl mb-2">🔄</div>
                <div className="text-[13px]" style={{ color: W.textMuted }}>Loading system health data...</div>
              </div>
            )}
          </div>

          {/* Data Coverage Summary */}
          {healthReport && (
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { label: 'Biomarkers', pct: healthReport.biomarkers.coverage, detail: `${healthReport.biomarkers.filled}/${healthReport.biomarkers.total}`, color: W.rose },
                { label: 'Genetics', pct: healthReport.genetics.coverage, detail: `${healthReport.genetics.filled}/${healthReport.genetics.total}`, color: W.lavender },
                { label: 'Biometrics', pct: healthReport.biometrics.coverage, detail: `${healthReport.biometrics.filled}/${healthReport.biometrics.total}`, color: W.sky },
              ].map(item => (
                <div key={item.label} className="rounded-2xl p-3.5 text-center" style={{ background: W.bg, border: `1px solid ${W.border}` }}>
                  <div className="text-[22px] font-bold font-serif" style={{ color: item.color }}>{item.pct}%</div>
                  <div className="text-[11px] font-semibold mt-0.5" style={{ color: W.text }}>{item.label}</div>
                  <div className="text-[10px]" style={{ color: W.textFaint }}>{item.detail} tracked</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Privacy Tab ── */}
      {activeTab === 'privacy' && (
        <div className="space-y-2.5" style={{ animation: 'settingsFadeIn 0.4s ease both' }}>
          <div className="flex items-center gap-2 px-1 mb-3">
            <span className="text-lg">🛡️</span>
            <h3 className="text-[15px] font-bold" style={{ color: W.text }}>Data Privacy Controls</h3>
          </div>

          <PrivacyToggle
            label="End-to-End Encryption"
            description="All health data is encrypted at rest using AES-256-GCM. Disabling this is not recommended."
            enabled={privacySettings.encryptAtRest}
            onToggle={() => togglePrivacy('encryptAtRest')}
          />
          <PrivacyToggle
            label="Anonymize Data Exports"
            description="Strip personal identifiers when exporting data for research or sharing."
            enabled={privacySettings.anonymizeExports}
            onToggle={() => togglePrivacy('anonymizeExports')}
          />
          <PrivacyToggle
            label="Share Bio-Status with Squad"
            description="Allow squad members to see your recovery status and readiness tier."
            enabled={privacySettings.shareWithSquad}
            onToggle={() => togglePrivacy('shareWithSquad')}
          />
          <PrivacyToggle
            label="AI-Powered Analysis"
            description="Allow the AI Brain to analyze your biomarkers for personalized recommendations."
            enabled={privacySettings.allowAIAnalysis}
            onToggle={() => togglePrivacy('allowAIAnalysis')}
          />
          <PrivacyToggle
            label="Auto-Delete After 90 Days"
            description="Automatically purge raw data older than 90 days. Aggregated scores are kept."
            enabled={privacySettings.autoDeleteAfter90d}
            onToggle={() => togglePrivacy('autoDeleteAfter90d')}
          />
          <PrivacyToggle
            label="Hide from Leaderboard"
            description="Remove your profile from the public squad leaderboard."
            enabled={privacySettings.hideFromLeaderboard}
            onToggle={() => togglePrivacy('hideFromLeaderboard')}
          />

          {/* Data Retention Info */}
          <div className="mt-4 rounded-2xl p-5" style={{ background: W.bg, border: `1px solid ${W.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📊</span>
              <span className="text-[13px] font-semibold" style={{ color: W.text }}>Data Retention</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Sleep logs', retention: '1 year', icon: '🌙' },
                { label: 'HRV readings', retention: '6 months', icon: '💓' },
                { label: 'Blood panels', retention: 'Indefinite', icon: '🩸' },
                { label: 'Genetic data', retention: 'Indefinite', icon: '🧬' },
                { label: 'Protocol logs', retention: '90 days', icon: '📋' },
                { label: 'Vault files', retention: 'Until deleted', icon: '📁' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-[12px]" style={{ color: W.textMuted }}>{item.label}</span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: W.text }}>{item.retention}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="mt-4 rounded-2xl p-5" style={{ background: W.roseBg, border: `1px solid ${W.roseBorder}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⚠️</span>
              <span className="text-[13px] font-bold" style={{ color: W.rose }}>Danger Zone</span>
            </div>
            <p className="text-[12px] mb-3 leading-relaxed" style={{ color: W.textMuted }}>
              These actions are permanent and cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200 active:scale-95"
                style={{ background: 'rgba(212,132,122,0.15)', border: `1px solid ${W.roseBorder}`, color: W.rose }}
              >
                Export All Data
              </button>
              <button
                className="px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200 active:scale-95"
                style={{ background: 'rgba(212,132,122,0.25)', border: `1px solid ${W.roseBorder}`, color: W.rose }}
              >
                Delete All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Progress Tab ── */}
      {activeTab === 'share' && (
        <div style={{ animation: 'settingsFadeIn 0.4s ease both' }}>
          <div className="flex items-center gap-2 px-1 mb-4">
            <span className="text-lg">📸</span>
            <h3 className="text-[15px] font-bold" style={{ color: W.text }}>Share Your Longevity Score</h3>
          </div>
          <p className="text-[12px] mb-5 leading-relaxed px-1" style={{ color: W.textMuted }}>
            Generate a clean, privacy-safe snapshot of your HUD. Sensitive biomarker values and genetic data are automatically redacted — only your performance grade and module coverage are shown.
          </p>
          <ShareSnapshot healthReport={healthReport} viveAge={viveAge} />
        </div>
      )}

      {/* Privacy Footer */}
      <div className="mt-6 text-center">
        <div
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl"
          style={{ background: W.bg, border: `1px solid ${W.border}` }}
        >
          <span className="text-base">🔒</span>
          <span className="text-[12px]" style={{ color: W.textMuted }}>
            Your data never leaves your encrypted vault
          </span>
        </div>
      </div>

      <style>{`
        @keyframes settingsFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BioVaultSettingsView;
