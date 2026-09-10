import React from 'react';
import type { Task } from '../../../hooks/useGamePlanData';
import { categoryColors } from '../../../hooks/useGamePlanData';

interface ActionListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
}

export const ActionList: React.FC<ActionListProps> = ({ tasks, onToggle }) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider px-1">Tasks</h3>
      {tasks.map(task => (
        <button
          key={task.id}
          onClick={() => onToggle(task.id)}
          className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 ${
            task.completed
              ? 'bg-zinc-800/30 border border-zinc-700/20'
              : 'bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 hover:border-zinc-600/50'
          }`}
        >
          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
            task.completed
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-zinc-600 hover:border-zinc-400'
          }`}>
            {task.completed && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="text-xl">{task.icon}</span>
          <div className="flex-1 text-left">
            <p className={`text-sm font-medium transition-all ${
              task.completed ? 'text-zinc-500 line-through' : 'text-white'
            }`}>
              {task.title}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${categoryColors[task.category] || 'text-zinc-400'}`}>
                {task.category}
              </span>
              {task.time && <span className="text-[10px] text-zinc-600">{task.time}</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
