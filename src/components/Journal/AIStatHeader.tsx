import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CYAN = '#00F0FF';
const GREEN = '#30D158';
const ORANGE = '#FF9F0A';

interface HealthStats {
  steps: number;
  miles: number;
  activeCalories: number;
  lastSynced: number | null;
  source: 'apple_health' | 'google_fit' | 'simulated';
}

function useHealthKitStats(): HealthStats {
  const [stats, setStats] = useState<HealthStats>({
    steps: 0,
    miles: 0,
    activeCalories: 0,
    lastSynced: null,
    source: 'simulated',
  });

  useEffect(() => {
    // Simulate ambient health data that updates periodically
    // In production, this would pull from Apple Health / Google Fit APIs
    const hour = new Date().getHours();
    const minuteOfDay = hour * 60 + new Date().getMinutes();
    
    // Realistic step curve: ramps up through the day
    const baseSteps = Math.round(minuteOfDay * 5.5 + Math.random() * 800);
    const baseMiles = +(baseSteps / 2100).toFixed(1);
    const baseCal = Math.round(baseSteps * 0.04 + Math.random() * 30);

    setStats({
      steps: baseSteps,
      miles: baseMiles,
      activeCalories: baseCal,
      lastSynced: Date.now(),
      source: 'simulated',
    });

    // Refresh every 60 seconds to simulate live sync
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        steps: prev.steps + Math.round(Math.random() * 120 + 20),
        miles: +((prev.steps + 80) / 2100).toFixed(1),
        activeCalories: prev.activeCalories + Math.round(Math.random() * 8 + 2),
        lastSynced: Date.now(),
      }));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function AIStatHeader() {
  const stats = useHealthKitStats();
  const syncAge = stats.lastSynced ? Math.round((Date.now() - stats.lastSynced) / 60000) : null;

  const statItems = [
    {
      icon: '\uD83D\uDEB6',
      value: formatNumber(stats.steps),
      label: 'Steps',
      color: CYAN,
      goal: 10000,
      current: stats.steps,
    },
    {
      icon: '\uD83D\uDCCD',
      value: `${stats.miles}`,
      label: 'Miles',
      color: GREEN,
      goal: 5,
      current: stats.miles,
    },
    {
      icon: '\uD83D\uDD25',
      value: `${stats.activeCalories}`,
      label: 'Active Cal',
      color: ORANGE,
      goal: 500,
      current: stats.activeCalories,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl px-3.5 py-3 mb-4"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">{'\u2764\uFE0F'}</span>
          <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Health Sync
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 4px ${GREEN}60` }} />
          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {syncAge === null ? 'Connecting...' : syncAge < 1 ? 'Just now' : `${syncAge}m ago`}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="flex gap-2">
        {statItems.map((item) => {
          const pct = Math.min(100, (item.current / item.goal) * 100);
          return (
            <div
              key={item.label}
              className="flex-1 rounded-xl px-2.5 py-2 text-center"
              style={{
                background: `${item.color}06`,
                border: `1px solid ${item.color}10`,
              }}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="text-[12px]">{item.icon}</span>
                <span className="text-[15px] font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {item.value}
                </span>
              </div>
              <span className="text-[9px] font-medium block mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {item.label}
              </span>
              {/* Mini progress bar */}
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  style={{ background: `${item.color}80` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
