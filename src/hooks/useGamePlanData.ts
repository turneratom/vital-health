import { useState, useCallback, useMemo } from 'react';

export interface Task {
  id: string;
  title: string;
  category: string;
  icon: string;
  completed: boolean;
  time?: string;
}

const defaultTasks: Task[] = [
  { id: '1', title: 'Morning Meditation', category: 'Mindset', icon: '🧘', completed: false, time: '6:00 AM' },
  { id: '2', title: 'Cold Exposure', category: 'Recovery', icon: '🧊', completed: false, time: '6:30 AM' },
  { id: '3', title: 'Strength Training', category: 'Training', icon: '🏋️', completed: false, time: '7:00 AM' },
  { id: '4', title: 'Protein Shake', category: 'Nutrition', icon: '🥤', completed: false, time: '8:00 AM' },
  { id: '5', title: 'Deep Work Block', category: 'Focus', icon: '🎯', completed: false, time: '9:00 AM' },
  { id: '6', title: 'Walk 10k Steps', category: 'Movement', icon: '🚶', completed: false, time: 'Throughout' },
  { id: '7', title: 'Evening Stretch', category: 'Recovery', icon: '🤸', completed: false, time: '8:00 PM' },
  { id: '8', title: 'Sleep by 10 PM', category: 'Rest', icon: '😴', completed: false, time: '10:00 PM' },
];

export const categoryColors: Record<string, string> = {
  Mindset: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Recovery: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Training: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Nutrition: 'text-green-400 bg-green-500/10 border-green-500/20',
  Focus: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Movement: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Rest: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
};

export interface QuickStat {
  label: string;
  value: string;
  icon: string;
}

export function useGamePlanData() {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);

  const completedCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const progress = useMemo(() => Math.round((completedCount / tasks.length) * 100), [completedCount, tasks.length]);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const quickStats: QuickStat[] = useMemo(() => [
    { label: 'Streak', value: '12d', icon: '🔥' },
    { label: 'Energy', value: '85%', icon: '⚡' },
    { label: 'Score', value: '92', icon: '🏆' },
  ], []);

  return {
    tasks,
    completedCount,
    progress,
    toggleTask,
    greeting,
    quickStats,
  };
}
