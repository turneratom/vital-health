import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ELITE_BACKGROUNDS_LIST } from '../../data/eliteAssets';

interface Task {
  id: string;
  title: string;
  category: string;
  icon: string;
  completed: boolean;
  time?: string;
}

const dailyTasks: Task[] = [
  { id: '1', title: 'Morning Meditation', category: 'Mindset', icon: '🧘', completed: false, time: '6:00 AM' },
  { id: '2', title: 'Cold Exposure', category: 'Recovery', icon: '🧊', completed: false, time: '6:30 AM' },
  { id: '3', title: 'Strength Training', category: 'Training', icon: '🏋️', completed: false, time: '7:00 AM' },
  { id: '4', title: 'Protein Shake', category: 'Nutrition', icon: '🥤', completed: false, time: '8:00 AM' },
  { id: '5', title: 'Deep Work Block', category: 'Focus', icon: '🎯', completed: false, time: '9:00 AM' },
  { id: '6', title: 'Walk 10k Steps', category: 'Movement', icon: '🚶', completed: false, time: 'Throughout' },
  { id: '7', title: 'Evening Stretch', category: 'Recovery', icon: '🤸', completed: false, time: '8:00 PM' },
  { id: '8', title: 'Sleep by 10 PM', category: 'Rest', icon: '😴', completed: false, time: '10:00 PM' },
];

const categoryColors: Record<string, string> = {
  Mindset: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Recovery: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Training: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  Nutrition: 'text-green-400 bg-green-500/10 border-green-500/20',
  Focus: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  Movement: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Rest: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
};

interface GamePlanHeroProps {
  isElite?: boolean;
}

export const GamePlanHero: React.FC<GamePlanHeroProps> = ({ isElite = false }) => {
  const [tasks, setTasks] = useState(dailyTasks);
  const [bgIndex, setBgIndex] = useState(0);
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  // Auto-rotate Elite backgrounds every 20s
  useEffect(() => {
    if (!isElite) return;
    const interval = setInterval(() => {
      setBgIndex(prev => (prev + 1) % ELITE_BACKGROUNDS_LIST.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [isElite]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="space-y-5">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-zinc-700/50 p-5"
        style={{
          background: isElite
            ? 'linear-gradient(135deg, #050508 0%, #0a0a12 50%, #050508 100%)'
            : 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%)',
        }}
      >
        {/* Elite Background Images — crossfade */}
        {isElite && (
          <div className="absolute inset-0">
            <AnimatePresence mode="sync">
              <motion.div
                key={bgIndex}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.18 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, ease: 'easeInOut' }}
                className="absolute inset-0"
              >
                <img
                  src={ELITE_BACKGROUNDS_LIST[bgIndex].url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </motion.div>
            </AnimatePresence>
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-[#050508]/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050508]/80 via-transparent to-[#050508]/80" />
          </div>
        )}

        {/* Standard gradient overlay */}
        {!isElite && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-cyan-500/5" />
        )}

        {/* Elite neon border glow */}
        {isElite && (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-teal-400/60 to-transparent" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
          </>
        )}

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-400 text-sm">{greeting()}</p>
              <h1 className="text-2xl font-bold text-white mt-1">Today&apos;s Game Plan</h1>
            </div>
            {isElite && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
                style={{
                  background: 'rgba(0, 240, 255, 0.06)',
                  borderColor: 'rgba(0, 240, 255, 0.15)',
                  boxShadow: '0 0 20px rgba(0, 240, 255, 0.08)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#00F0FF" />
                </svg>
                <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#00F0FF' }}>
                  ELITE
                </span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 bg-zinc-700/50 rounded-full h-2.5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: isElite
                    ? 'linear-gradient(90deg, #00F0FF, #00D4AA)'
                    : 'linear-gradient(90deg, #10b981, #06b6d4)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
            <span
              className="text-sm font-semibold"
              style={{ color: isElite ? '#00F0FF' : '#34d399' }}
            >
              {progress}%
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">{completedCount} of {tasks.length} tasks completed</p>

          {/* Elite background indicator dots */}
          {isElite && (
            <div className="flex items-center gap-1.5 mt-3">
              {ELITE_BACKGROUNDS_LIST.map((bg, i) => (
                <button
                  key={bg.id}
                  onClick={() => setBgIndex(i)}
                  className="transition-all duration-300"
                  title={bg.label}
                >
                  <div
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === bgIndex ? 16 : 6,
                      height: 6,
                      background: i === bgIndex ? '#00F0FF' : 'rgba(255,255,255,0.15)',
                      boxShadow: i === bgIndex ? '0 0 8px rgba(0,240,255,0.4)' : 'none',
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Streak', value: '12d', icon: '🔥' },
          { label: 'Energy', value: '85%', icon: '⚡' },
          { label: 'Score', value: '92', icon: '🏆' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
            className="rounded-xl p-3 text-center border"
            style={{
              background: isElite ? 'rgba(0, 240, 255, 0.03)' : 'rgba(39, 39, 42, 0.6)',
              borderColor: isElite ? 'rgba(0, 240, 255, 0.08)' : 'rgba(63, 63, 70, 0.4)',
            }}
          >
            <span className="text-lg">{stat.icon}</span>
            <p className="text-white font-bold text-lg mt-1">{stat.value}</p>
            <p className="text-zinc-500 text-xs">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider px-1">Tasks</h3>
        {tasks.map((task, i) => (
          <motion.button
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 + i * 0.03 }}
            onClick={() => toggleTask(task.id)}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200"
            style={{
              background: task.completed
                ? isElite ? 'rgba(0, 240, 255, 0.02)' : 'rgba(39, 39, 42, 0.3)'
                : isElite ? 'rgba(0, 240, 255, 0.04)' : 'rgba(39, 39, 42, 0.6)',
              border: `1px solid ${
                task.completed
                  ? isElite ? 'rgba(0, 240, 255, 0.05)' : 'rgba(63, 63, 70, 0.2)'
                  : isElite ? 'rgba(0, 240, 255, 0.1)' : 'rgba(63, 63, 70, 0.5)'
              }`,
            }}
          >
            <div
              className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all"
              style={{
                background: task.completed ? (isElite ? '#00D4AA' : '#10b981') : 'transparent',
                borderColor: task.completed
                  ? (isElite ? '#00D4AA' : '#10b981')
                  : (isElite ? 'rgba(0, 240, 255, 0.25)' : 'rgba(82, 82, 91, 1)'),
              }}
            >
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
          </motion.button>
        ))}
      </div>

      {progress === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4 rounded-xl border"
          style={{
            background: isElite
              ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.08), rgba(0, 212, 170, 0.08))'
              : 'linear-gradient(90deg, rgba(16, 185, 129, 0.1), rgba(6, 182, 212, 0.1))',
            borderColor: isElite ? 'rgba(0, 240, 255, 0.15)' : 'rgba(16, 185, 129, 0.2)',
          }}
        >
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-bold" style={{ color: isElite ? '#00F0FF' : '#34d399' }}>
            Perfect Day Complete!
          </p>
          <p className="text-zinc-500 text-xs mt-1">All tasks finished. Rest well tonight.</p>
        </motion.div>
      )}
    </div>
  );
};

export default GamePlanHero;
