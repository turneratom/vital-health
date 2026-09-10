import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfidenceBar } from './ConfidenceBar';
import type { Insight } from './types';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

export function InsightCard({ insight, index, ghostMode }: { insight: Insight; index: number; ghostMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const cardBg = ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.02)';
  const cardBorder = ghostMode ? 'rgba(160,160,160,0.06)' : `${insight.accentColor}15`;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        backdropFilter: 'blur(8px)',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Card header */}
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl shrink-0">{insight.icon}</span>
            <div className="min-w-0">
              <h3
                className="text-[15px] font-semibold tracking-tight truncate"
                style={{ color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.9)' }}
              >
                {insight.humanTitle}
              </h3>
              <p
                className="text-[11px] mt-0.5 truncate"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.35)' }}
              >
                {insight.tagline}
              </p>
            </div>
          </div>

          {/* Result badge */}
          <div
            className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold whitespace-nowrap"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.06)' : `${insight.accentColor}12`,
              color: ghostMode ? 'rgba(160,160,160,0.5)' : insight.accentColor,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${insight.accentColor}20`}`,
            }}
          >
            {insight.resultBadge}
          </div>
        </div>

        {/* Your result line */}
        <div className="flex items-center gap-2 mt-2.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.3)' : insight.accentColor,
              boxShadow: ghostMode ? 'none' : `0 0 6px ${insight.accentColor}40`,
            }}
          />
          <span
            className="text-[12px] font-medium"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : insight.accentColor }}
          >
            {insight.yourResult}
          </span>
          <div className="flex-1" />
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[10px]"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}
          >
            &#x25BC;
          </motion.span>
        </div>
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-1"
              style={{ borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'}` }}
            >
              {/* What it means */}
              <div className="mb-3">
                <span
                  className="text-[9px] font-mono uppercase tracking-[0.2em] block mb-1.5"
                  style={{ color: `${neon}0.3)` }}
                >
                  What This Means
                </span>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : 'rgba(255,255,255,0.55)' }}
                >
                  {insight.whatItMeans}
                </p>
              </div>

              {/* Action items */}
              <div className="mb-3">
                <span
                  className="text-[9px] font-mono uppercase tracking-[0.2em] block mb-2"
                  style={{ color: `${neon}0.3)` }}
                >
                  Your Action Plan
                </span>
                <div className="flex flex-col gap-2">
                  {insight.actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{
                          background: ghostMode ? 'rgba(160,160,160,0.06)' : `${insight.accentColor}10`,
                          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${insight.accentColor}20`}`,
                        }}
                      >
                        <span
                          className="text-[8px] font-mono font-bold"
                          style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : insight.accentColor }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <p
                        className="text-[12px] leading-relaxed"
                        style={{ color: ghostMode ? 'rgba(200,200,200,0.45)' : 'rgba(255,255,255,0.5)' }}
                      >
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Confidence bar */}
              <ConfidenceBar value={insight.confidence} color={insight.accentColor} ghostMode={ghostMode} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
