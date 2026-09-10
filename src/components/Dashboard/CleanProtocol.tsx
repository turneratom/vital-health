import React, { useState } from 'react';

const supplements = [
  { name: 'Vitamin D3', dose: '5000 IU', time: 'Morning', icon: '☀️', taken: false },
  { name: 'Omega-3 Fish Oil', dose: '2000mg', time: 'Morning', icon: '🐟', taken: false },
  { name: 'Magnesium Glycinate', dose: '400mg', time: 'Evening', icon: '🌙', taken: false },
  { name: 'Zinc', dose: '30mg', time: 'Evening', icon: '⚡', taken: false },
  { name: 'Ashwagandha', dose: '600mg', time: 'Morning', icon: '🌿', taken: false },
  { name: 'Creatine Monohydrate', dose: '5g', time: 'Any', icon: '💪', taken: false },
];

const CleanProtocol: React.FC<{ mounted?: boolean }> = ({ mounted }) => {
  const [items, setItems] = useState(supplements);
  const takenCount = items.filter(s => s.taken).length;
  const progress = Math.round((takenCount / items.length) * 100);

  const toggleTaken = (index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, taken: !item.taken } : item));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Supplement Protocol</h2>
        <span className="text-sm text-zinc-400">{takenCount}/{items.length} taken</span>
      </div>

      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <button
            key={item.name}
            onClick={() => toggleTaken(index)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
              item.taken
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <div className="flex-1 text-left">
              <p className={`text-sm font-medium ${item.taken ? 'text-emerald-400 line-through' : 'text-white'}`}>
                {item.name}
              </p>
              <p className="text-xs text-zinc-500">{item.dose} · {item.time}</p>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              item.taken
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'border-zinc-600'
            }`}>
              {item.taken && <span className="text-xs">✓</span>}
            </div>
          </button>
        ))}
      </div>

      {progress === 100 && (
        <div className="text-center py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <p className="text-emerald-400 font-medium">🎉 All supplements taken!</p>
        </div>
      )}
    </div>
  );
};

export default CleanProtocol;
