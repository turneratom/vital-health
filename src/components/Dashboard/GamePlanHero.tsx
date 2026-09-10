import React from 'react';
import { Header } from './GamePlan/Header';
import { StatsGrid } from './GamePlan/StatsGrid';
import { ActionList } from './GamePlan/ActionList';
import { useGamePlanData } from '../../hooks/useGamePlanData';

const GamePlanHero: React.FC = () => {
  const { tasks, completedCount, progress, toggleTask, greeting, quickStats } = useGamePlanData();

  return (
    <div className="space-y-5">
      <Header
        greeting={greeting}
        progress={progress}
        completedCount={completedCount}
        totalCount={tasks.length}
      />
      <StatsGrid stats={quickStats} />
      <ActionList tasks={tasks} onToggle={toggleTask} />
      {progress === 100 && (
        <div className="text-center py-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/20">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-emerald-400 font-bold">Perfect Day Complete!</p>
          <p className="text-zinc-500 text-xs mt-1">All tasks finished. Rest well tonight.</p>
        </div>
      )}
    </div>
  );
};

export default GamePlanHero;
