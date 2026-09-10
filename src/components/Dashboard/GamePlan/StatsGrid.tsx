import React from 'react';
import type { QuickStat } from '../../../hooks/useGamePlanData';

interface StatsGridProps {
  stats: QuickStat[];
}

export const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="bg-zinc-800/60 border border-zinc-700/40 rounded-xl p-3 text-center"
        >
          <span className="text-lg">{stat.icon}</span>
          <p className="text-white font-bold text-lg mt-1">{stat.value}</p>
          <p className="text-zinc-500 text-xs">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};
