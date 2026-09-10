import { motion } from 'framer-motion';
import type { ChapterDef } from './types';

export function ChapterHeader({ chapter, ghostMode }: { chapter: ChapterDef; ghostMode: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
      className="pt-8 pb-4 first:pt-0"
    >
      {/* Chapter number */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="h-px flex-1 max-w-[40px]"
          style={{ background: ghostMode ? 'rgba(160,160,160,0.1)' : `${chapter.accentColor}20` }}
        />
        <span
          className="text-[9px] font-mono uppercase tracking-[0.3em] font-semibold"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${chapter.accentColor}80` }}
        >
          Chapter {chapter.number}
        </span>
        <div
          className="h-px flex-1"
          style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : `${chapter.accentColor}10` }}
        />
      </div>

      {/* Title row */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{chapter.icon}</span>
        <div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{
              color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.9)',
            }}
          >
            {chapter.title}
          </h2>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.35)' }}
          >
            {chapter.subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
