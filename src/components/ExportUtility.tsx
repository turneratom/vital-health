/**
 * Doctor Visit Prep — Export Utility
 *
 * Packages logged twin-session data (BioResume + dashboard) into a
 * visit-prep packet Brad can download as JSON or a printable report image.
 * No invented clinical outcomes — only logged/available values + clear disclaimer.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';

/* ── Types ── */
interface VisitPacket {
  meta: {
    title: string;
    exportedAt: string;
    version: string;
    sessionId: string;
    periodLabel: string;
    purpose: string;
    disclaimer: string;
  };
  bioResume: {
    available: boolean;
    avgVitality: number | null;
    avgHrv: number | null;
    avgSleep: number | null;
    avgAdherence: number | null;
    totalWorkoutMinutes: number | null;
    trend: string | null;
    daysWithData: number | null;
    biomarkers: Array<{ label: string; value: number | string; unit: string; status: string }>;
    tensionRegions: string[];
    daily: Array<{
      date: string;
      dayLabel: string;
      vitalityScore: number;
      avgHrv: number;
      sleepScore: number;
      adherencePct: number;
      workoutMinutes: number;
    }>;
  };
  last24h: {
    available: boolean;
    currentHrv: number | null;
    totalCaloriesIn: number | null;
    totalCaloriesOut: number | null;
    totalProtein: number | null;
    totalDuration: number | null;
  };
}

function buildVisitPacket(sessionId: string, resumeData: any, dashData: any): VisitPacket {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const summary = resumeData?.summary;
  const days = Array.isArray(resumeData?.days) ? resumeData.days : [];

  return {
    meta: {
      title: 'Doctor Visit Prep Packet',
      exportedAt: now.toISOString(),
      version: 'Vive 4.0',
      sessionId,
      periodLabel: `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      purpose: 'Personal visit-prep summary of logged vitals, protocols, and lab values stored on this twin session.',
      disclaimer:
        'Not medical advice. Not a clinical record. Values reflect what you logged in Vive (manual vitals, food log, lab paste, protocols). Bring original lab reports to your clinician.',
    },
    bioResume: {
      available: !!resumeData,
      avgVitality: summary?.avgVitality ?? null,
      avgHrv: summary?.avgHrv ?? null,
      avgSleep: summary?.avgSleep ?? null,
      avgAdherence: summary?.avgAdherence ?? null,
      totalWorkoutMinutes: summary?.totalWorkoutMinutes ?? null,
      trend: summary?.trend ?? null,
      daysWithData: summary?.daysWithData ?? null,
      biomarkers: Array.isArray(resumeData?.biomarkers)
        ? resumeData.biomarkers.map((b: any) => ({
            label: String(b.label ?? ''),
            value: b.value,
            unit: String(b.unit ?? ''),
            status: String(b.status ?? 'logged'),
          }))
        : [],
      tensionRegions: Array.isArray(summary?.tensionRegions) ? summary.tensionRegions : [],
      daily: days.map((d: any) => ({
        date: String(d.date ?? ''),
        dayLabel: String(d.dayLabel ?? ''),
        vitalityScore: Number(d.vitalityScore ?? 0),
        avgHrv: Number(d.avgHrv ?? 0),
        sleepScore: Number(d.sleepScore ?? 0),
        adherencePct: Number(d.adherencePct ?? 0),
        workoutMinutes: Number(d.workoutMinutes ?? 0),
      })),
    },
    last24h: {
      available: !!dashData,
      currentHrv: dashData?.currentHrv ?? null,
      totalCaloriesIn: dashData?.totalCaloriesIn ?? null,
      totalCaloriesOut: dashData?.totalCaloriesOut ?? null,
      totalProtein: dashData?.totalProtein ?? null,
      totalDuration: dashData?.totalDuration ?? null,
    },
  };
}

function generateVisitReportImage(packet: VisitPacket): void {
  const canvas = document.createElement('canvas');
  const W = 595;
  const H = 842;
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0A0A0B';
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(0,255,204,0.12)');
  grad.addColorStop(1, 'rgba(59,130,246,0.08)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 88);

  ctx.fillStyle = '#F0F0F4';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Doctor Visit Prep Packet', 32, 36);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(packet.meta.periodLabel, 32, 56);
  ctx.fillText(`Session ${packet.meta.sessionId.slice(0, 18)}…`, 32, 72);

  let y = 112;
  ctx.fillStyle = '#00FFCC';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('LOGGED SUMMARY (7-DAY BIO-RESUME)', 32, y);

  y += 18;
  const metrics = [
    { label: 'Vitality', value: packet.bioResume.avgVitality != null ? String(packet.bioResume.avgVitality) : '—' },
    { label: 'HRV avg', value: packet.bioResume.avgHrv != null ? `${packet.bioResume.avgHrv} ms` : '—' },
    { label: 'Sleep', value: packet.bioResume.avgSleep != null ? String(packet.bioResume.avgSleep) : '—' },
    { label: 'Adherence', value: packet.bioResume.avgAdherence != null ? `${packet.bioResume.avgAdherence}%` : '—' },
  ];
  const colW = (W - 64) / metrics.length;
  metrics.forEach((m, i) => {
    const x = 32 + i * colW;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    roundRect(ctx, x, y, colW - 8, 56, 8);
    ctx.fill();
    ctx.fillStyle = '#F0F0F4';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(m.value, x + 10, y + 28);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(m.label.toUpperCase(), x + 10, y + 44);
  });

  y += 78;
  ctx.fillStyle = '#F0F0F4';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('BIOMARKERS ON FILE', 32, y);
  y += 14;

  const biomarkers = packet.bioResume.biomarkers.slice(0, 8);
  if (biomarkers.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('No lab values logged yet — paste labs in Bio-Vault before your visit.', 32, y + 16);
    y += 40;
  } else {
    biomarkers.forEach((b) => {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      roundRect(ctx, 32, y, W - 64, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#F0F0F4';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`${b.label}: ${b.value} ${b.unit}`, 42, y + 18);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(String(b.status), W - 110, y + 18);
      y += 34;
    });
  }

  y += 8;
  ctx.fillStyle = '#F0F0F4';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('LAST 24H (LOGGED)', 32, y);
  y += 18;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  const l24 = packet.last24h;
  ctx.fillText(
    `HRV: ${l24.currentHrv ?? '—'} · Calories in: ${l24.totalCaloriesIn ?? '—'} · Protein: ${l24.totalProtein ?? '—'}g · Activity: ${l24.totalDuration ?? '—'} min`,
    32,
    y,
  );

  // Disclaimer
  ctx.fillStyle = 'rgba(255,184,107,0.85)';
  ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
  const disc = packet.meta.disclaimer;
  wrapText(ctx, disc, 32, H - 48, W - 64, 12);

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Generated by Vive — personal visit prep only', 32, H - 16);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vive-doctor-visit-prep-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface ExportUtilityProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportUtility({ isOpen, onClose }: ExportUtilityProps) {
  const [exporting, setExporting] = useState<'json' | 'pdf' | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const sessionId = useMemo(() => getTwinSessionId(), []);

  const dashData = useQuery(api.dashboardData.getLast24hDashboardData, { sessionId });
  const resumeData = useQuery(api.queries.getBioResumeData, { sessionId });

  const handleExportJSON = useCallback(() => {
    setExporting('json');
    setDone(null);
    setTimeout(() => {
      const packet = buildVisitPacket(sessionId, resumeData, dashData);
      const json = JSON.stringify(packet, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vive-doctor-visit-prep-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(null);
      setDone('json');
    }, 400);
  }, [sessionId, resumeData, dashData]);

  const handleExportPDF = useCallback(() => {
    setExporting('pdf');
    setDone(null);
    setTimeout(() => {
      const packet = buildVisitPacket(sessionId, resumeData, dashData);
      generateVisitReportImage(packet);
      setExporting(null);
      setDone('pdf');
    }, 500);
  }, [sessionId, resumeData, dashData]);

  if (!isOpen) return null;

  const hasResume = !!resumeData;
  const biomarkerCount = resumeData?.biomarkers?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 overflow-hidden"
        style={{
          background: 'rgba(14,14,18,0.95)',
          border: '1px solid rgba(0,255,204,0.15)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,255,204,0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-white tracking-tight">Doctor Visit Prep</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-white/50 text-sm">✕</span>
            </button>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Export a visit-prep packet from your twin session — Bio-Resume + last 24h logs. Not a clinical chart.
          </p>
          <p className="text-[10px] mt-2 font-mono" style={{ color: 'rgba(0,255,204,0.55)' }}>
            session · {sessionId.slice(0, 24)}{sessionId.length > 24 ? '…' : ''}
            {hasResume ? ` · ${biomarkerCount} biomarkers on file` : ' · Bio-Resume loading / empty'}
          </p>
        </div>

        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handleExportJSON}
            disabled={exporting !== null}
            className="w-full text-left p-4 rounded-xl transition-all duration-200"
            style={{
              background: done === 'json' ? 'rgba(0,220,130,0.08)' : 'rgba(0,255,204,0.06)',
              border: `1px solid ${done === 'json' ? 'rgba(0,220,130,0.2)' : 'rgba(0,255,204,0.12)'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ background: 'rgba(0,255,204,0.12)' }}
              >
                {exporting === 'json' ? <span className="animate-spin text-sm">⟳</span> : done === 'json' ? '✓' : '{ }'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {done === 'json' ? 'JSON Downloaded' : 'Visit packet · JSON'}
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Structured Bio-Resume + 24h logs for your records
                </div>
              </div>
              <span className="text-xs font-mono" style={{ color: 'rgba(0,255,204,0.6)' }}>.json</span>
            </div>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting !== null}
            className="w-full text-left p-4 rounded-xl transition-all duration-200"
            style={{
              background: done === 'pdf' ? 'rgba(0,220,130,0.08)' : 'rgba(59,130,246,0.06)',
              border: `1px solid ${done === 'pdf' ? 'rgba(0,220,130,0.2)' : 'rgba(59,130,246,0.12)'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                style={{ background: 'rgba(59,130,246,0.12)' }}
              >
                {exporting === 'pdf' ? <span className="animate-spin text-sm">⟳</span> : done === 'pdf' ? '✓' : '📋'}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {done === 'pdf' ? 'Report Downloaded' : 'Visit packet · printable'}
                </div>
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  One-page summary image to bring / screenshot for the visit
                </div>
              </div>
              <span className="text-xs font-mono" style={{ color: 'rgba(59,130,246,0.6)' }}>.png</span>
            </div>
          </button>
        </div>

        <div className="px-6 py-3 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[10px]" style={{ color: 'rgba(255,184,107,0.55)' }}>
            Not medical advice. Bring original lab reports to your clinician.
          </p>
        </div>
      </div>
    </div>
  );
}
