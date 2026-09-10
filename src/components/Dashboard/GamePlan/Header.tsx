import React from 'react';

interface HeaderProps {
  greeting: string;
  progress: number;
  completedCount: number;
  totalCount: number;
}

export const Header: React.FC<HeaderProps> = ({ greeting, progress, completedCount, totalCount }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700/50 p-5">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5" />
      <div className="relative">
        <p className="text-zinc-400 text-sm">{greeting}</p>
        <h1 className="text-2xl font-bold text-white mt-1">Today&apos;s Game Plan</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex-1 bg-zinc-700/50 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-emerald-400">{progress}%</span>
        </div>
        <p className="text-xs text-zinc-500 mt-2">{completedCount} of {totalCount} tasks completed</p>
      </div>
    </div>
  );
};
