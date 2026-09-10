import { motion } from 'framer-motion';

export function ConfidenceBar({ value, color, ghostMode }: { value: number; color: string; ghostMode: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>
        Confidence
      </span>
      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, delay: 0.3, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          style={{
            background: ghostMode ? 'rgba(160,160,160,0.3)' : color,
            boxShadow: ghostMode ? 'none' : `0 0 8px ${color}40`,
          }}
        />
      </div>
      <span className="text-[10px] font-mono font-semibold tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : color }}>
        {value}%
      </span>
    </div>
  );
}
