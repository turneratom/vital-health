import { motion } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

/* ── Plain-language insight generator — Athletic Director partner voice ── */
interface HealthInsight {
  id: string;
  icon: string;
  title: string;
  summary: string;
  status: 'great' | 'good' | 'watch';
  detail: string;
}

function getStatusColor(status: 'great' | 'good' | 'watch', ghostMode: boolean): string {
  if (ghostMode) return 'rgba(160,160,160,0.5)';
  switch (status) {
    case 'great': return '#30D158';
    case 'good': return '#00F0FF';
    case 'watch': return '#FFB86B';
  }
}

function getStatusLabel(status: 'great' | 'good' | 'watch'): string {
  switch (status) {
    case 'great': return 'Dialed In';
    case 'good': return 'On Track';
    case 'watch': return 'Pivoting';
  }
}

const HEALTH_INSIGHTS: HealthInsight[] = [
  {
    id: 'recovery',
    icon: '\u26A1',
    title: 'Recovery',
    summary: 'We\'re in an optimal recovery window today',
    status: 'great',
    detail: 'Your body bounced back well from yesterday. We saw deep sleep and your HRV is above your personal average. Today is a great day for us to push the intensity up.',
  },
  {
    id: 'sleep',
    icon: '\uD83C\uDF19',
    title: 'Sleep',
    summary: 'We logged 7 hours and 36 minutes last night',
    status: 'good',
    detail: 'That puts us at 95% of our sleep target. Deep sleep was solid at 1h 34m. Let\'s try winding down 15 minutes earlier tonight to close the gap completely.',
  },
  {
    id: 'heart',
    icon: '\u2764\uFE0F',
    title: 'Heart Health',
    summary: 'Resting heart rate is holding steady at 72 bpm',
    status: 'good',
    detail: 'This is consistent with our 7-day trend and well within your normal range. HRV at 48ms shows good autonomic balance — we\'re in a healthy rhythm.',
  },
  {
    id: 'activity',
    icon: '\uD83D\uDEB6',
    title: 'Movement',
    summary: 'We\'ve covered 6,420 steps so far today',
    status: 'watch',
    detail: 'We\'re at 64% of our daily goal. A 20-minute walk this afternoon gets us back on pace. Your recovery score says the body is ready — let\'s use that.',
  },
  {
    id: 'hydration',
    icon: '\uD83D\uDCA7',
    title: 'Overall Wellness',
    summary: 'All vitals are within our target ranges',
    status: 'great',
    detail: 'Blood oxygen at 98%, body temp normal at 98.2\u00b0F, respiratory rate steady at 15 breaths per minute. We\'re in a strong position across the board.',
  },
];

/* ── Insight Card ── */
function InsightCard({ insight, index, ghostMode }: { insight: HealthInsight; index: number; ghostMode: boolean }) {
  const statusColor = getStatusColor(insight.status, ghostMode);
  const statusLabel = getStatusLabel(insight.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-xl overflow-hidden"
      style={{
        background: ghostMode ? 'rgba(12,12,12,0.5)' : '#050505',
        borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,240,255,0.12)'}`,
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-2.5">
          <span
            className="text-lg flex-shrink-0 mt-0.5"
            style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}
          >
            {insight.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span
                className="typo-header text-[12px]"
                style={{ color: ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.85)' }}
              >
                {insight.title}
              </span>
              <span
                className="typo-label px-2 py-0.5 rounded-full"
                style={{
                  color: statusColor,
                  background: ghostMode ? 'rgba(160,160,160,0.06)' : `${statusColor}12`,
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${statusColor}25`}`,
                }}
              >
                {statusLabel}
              </span>
            </div>

            {/* Plain language summary */}
            <p
              className="text-[14px] font-medium leading-snug mb-2"
              style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.7)' }}
            >
              {insight.summary}
            </p>

            {/* Detail text */}
            <p
              className="text-[12px] leading-relaxed"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : '#888888' }}
            >
              {insight.detail}
            </p>
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-3 flex items-center gap-2">
          <div
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)' }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: insight.status === 'great' ? '100%' : insight.status === 'good' ? '75%' : '50%' }}
              transition={{ duration: 0.8, delay: 0.3 + index * 0.1, ease: [0.4, 0, 0.2, 1] }}
              className="h-full rounded-full"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.3)'
                  : `linear-gradient(90deg, ${statusColor}66, ${statusColor})`,
                boxShadow: ghostMode ? 'none' : `0 0 8px ${statusColor}40`,
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN EXPORT ── */
/* ══════════════════════════════════════════════════════════════ */
export function HumanSummaryCard() {
  const ghostMode = useGhostMode();

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-1">
        <div
          className="h-px flex-1"
          style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,240,255,0.08)' }}
        />
        <span
          className="typo-label text-[11px]"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : undefined }}
        >
          HOW WE&apos;RE DOING TODAY
        </span>
        <div
          className="h-px flex-1"
          style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,240,255,0.08)' }}
        />
      </div>

      {/* Insight cards */}
      {HEALTH_INSIGHTS.map((insight, i) => (
        <InsightCard key={insight.id} insight={insight} index={i} ghostMode={ghostMode} />
      ))}

      {/* Bottom note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="flex items-center justify-center gap-2 pt-2 pb-1"
      >
        <span
          className="typo-sublabel"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : undefined }}
        >
          Based on our latest biometric data
        </span>
        <span
          className="text-[10px] font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{
            color: ghostMode ? 'rgba(160,160,160,0.4)' : '#30D158',
            background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(48,209,88,0.08)',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(48,209,88,0.12)'}`,
          }}
        >
          {'\u2713'} Looking Strong
        </span>
      </motion.div>
    </div>
  );
}
