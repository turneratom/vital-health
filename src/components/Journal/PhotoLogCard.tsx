import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CYAN = '#00F0FF';
const PURPLE = '#BF5AF2';
const CYAN_DIM = 'rgba(0,240,255,';
const PURPLE_DIM = 'rgba(191,90,242,';

interface PhotoLogCardProps {
  name: string;
  photoUrl: string;
  quickAnalysis: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fuelScore?: number;
  time: string;
  source?: string;
  ghostMode: boolean;
  type?: 'fueling' | 'movement';
}

export function PhotoLogCard({
  name,
  photoUrl,
  quickAnalysis,
  calories,
  protein,
  carbs,
  fat,
  fuelScore,
  time,
  source,
  ghostMode,
  type = 'fueling',
}: PhotoLogCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const accentColor = type === 'movement' ? CYAN : PURPLE;
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.95)';
  const textSecondary = ghostMode ? 'rgba(180,180,180,0.5)' : 'rgba(255,255,255,0.6)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)';

  const scoreColor = (fuelScore || 0) >= 8 ? '#30D158' : (fuelScore || 0) >= 6 ? '#00F0FF' : (fuelScore || 0) >= 4 ? '#FBBF24' : '#FF6B6B';

  // Detect vertical images for blurred background treatment
  const handleImageLoad = () => {
    setImageLoaded(true);
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      setIsVertical(naturalHeight > naturalWidth);
    }
  };

  // Build data tags from available nutritional info
  const dataTags: { icon: string; label: string; color: string }[] = [];
  if (calories !== undefined) dataTags.push({ icon: '🔥', label: `${calories} kcal`, color: '#FF9F0A' });
  if (protein !== undefined) dataTags.push({ icon: '🥩', label: `${protein}g Protein`, color: CYAN });
  if (carbs !== undefined) dataTags.push({ icon: '🌾', label: `${carbs}g Carbs`, color: '#6B8AFF' });
  if (fat !== undefined) dataTags.push({ icon: '🫒', label: `${fat}g Fat`, color: '#FFB86B' });

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden relative cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      style={{
        background: ghostMode ? 'rgba(20,20,22,0.6)' : 'rgba(8,8,14,0.65)',
        border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${CYAN}30`}`,
        boxShadow: ghostMode
          ? '0 2px 12px rgba(0,0,0,0.3)'
          : `0 0 20px ${CYAN_DIM}0.1), 0 0 40px ${CYAN_DIM}0.05), 0 4px 24px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Neon top accent line */}
      {!ghostMode && (
        <div className="absolute top-0 left-0 right-0 h-[1.5px] z-30" style={{
          background: `linear-gradient(90deg, transparent 5%, ${CYAN}55 20%, ${CYAN}88 50%, ${CYAN}55 80%, transparent 95%)`,
        }} />
      )}

      {/* ── 16:9 Image Container with Inner Glow ── */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16/9' }}>

        {/* Blurred background for vertical images */}
        {isVertical && imageLoaded && (
          <div className="absolute inset-0 z-0">
            <img
              src={photoUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              style={{
                filter: 'blur(28px) saturate(1.3) brightness(0.45)',
                transform: 'scale(1.15)',
              }}
            />
            <div className="absolute inset-0" style={{
              background: 'rgba(0,0,0,0.25)',
            }} />
          </div>
        )}

        {/* Placeholder shimmer while loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 z-10">
            <div className="w-full h-full" style={{
              background: ghostMode
                ? 'rgba(30,30,32,0.8)'
                : `linear-gradient(135deg, rgba(12,8,22,0.9), ${CYAN_DIM}0.03), rgba(12,8,22,0.9))`,
            }}>
              <motion.div
                className="absolute inset-0"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{
                  background: `linear-gradient(90deg, transparent, ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'}, transparent)`,
                }}
              />
            </div>
          </div>
        )}

        {/* Main image — object-contain for vertical, object-cover for landscape */}
        <img
          ref={imgRef}
          src={photoUrl}
          alt={name}
          className="w-full h-full relative z-[1]"
          onLoad={handleImageLoad}
          onError={() => setImageLoaded(true)}
          style={{
            objectFit: isVertical ? 'contain' : 'cover',
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        />

        {/* ── Inner Glow Effect — subtle #00F0FF inset glow ── */}
        {!ghostMode && (
          <div className="absolute inset-0 z-[5] pointer-events-none rounded-t-2xl" style={{
            boxShadow: `inset 0 0 30px ${CYAN_DIM}0.08), inset 0 0 60px ${CYAN_DIM}0.04), inset 0 0 100px ${CYAN_DIM}0.02)`,
          }} />
        )}

        {/* Bottom gradient overlay for text readability */}
        <div className="absolute inset-0 z-[6] pointer-events-none" style={{
          background: `linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.08) 55%, transparent 100%)`,
        }} />

        {/* Top vignette for badges */}
        <div className="absolute inset-0 z-[6] pointer-events-none" style={{
          background: `linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%)`,
        }} />

        {/* Neon border glow on sides */}
        {!ghostMode && (
          <>
            <div className="absolute top-0 left-0 bottom-0 w-[1px] z-[7] pointer-events-none" style={{
              background: `linear-gradient(to bottom, ${CYAN}55, ${CYAN}20, transparent 70%)`,
            }} />
            <div className="absolute top-0 right-0 bottom-0 w-[1px] z-[7] pointer-events-none" style={{
              background: `linear-gradient(to bottom, ${CYAN}55, ${CYAN}20, transparent 70%)`,
            }} />
          </>
        )}

        {/* ── Data Tags — minimalist nutritional overlays ── */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 items-end">
          {/* Source badge */}
          {source && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg backdrop-blur-md" style={{
              background: 'rgba(0,0,0,0.55)',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : `${CYAN_DIM}0.2)`}`,
            }}>
              <span className="text-[9px]">{source === 'Photo' ? '📸' : source === 'Voice' ? '🎙' : '🔄'}</span>
              <span className="text-[8px] font-mono font-bold uppercase tracking-[0.12em]" style={{
                color: ghostMode ? 'rgba(200,200,200,0.7)' : CYAN,
              }}>{source}</span>
            </div>
          )}

          {/* Nutritional data tags */}
          {dataTags.map((tag, i) => (
            <motion.div
              key={tag.label}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}
              className="flex items-center gap-1.5 px-2 py-[3px] rounded-md backdrop-blur-md"
              style={{
                background: ghostMode ? 'rgba(40,40,42,0.7)' : 'rgba(0,0,0,0.55)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${tag.color}22`}`,
              }}
            >
              <span className="text-[8px]">{tag.icon}</span>
              <span className="text-[9px] font-mono font-bold tabular-nums" style={{
                color: ghostMode ? 'rgba(180,180,180,0.6)' : `${tag.color}DD`,
              }}>{tag.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Fuel Score badge — top left */}
        {fuelScore !== undefined && (
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg backdrop-blur-md" style={{
              background: 'rgba(0,0,0,0.55)',
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.12)' : `${scoreColor}30`}`,
              boxShadow: ghostMode ? 'none' : `0 0 12px ${scoreColor}18`,
            }}>
              <span className="text-[10px]">⚡</span>
              <span className="text-[11px] font-mono font-bold tabular-nums" style={{
                color: ghostMode ? 'rgba(160,160,160,0.6)' : scoreColor,
              }}>{fuelScore}/10</span>
            </div>
          </div>
        )}

        {/* ── AI Quick Analysis Overlay — bottom of image ── */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-3.5 pt-8">
          {/* Meal name */}
          <h3 className="text-[15px] font-semibold mb-2 leading-tight" style={{
            color: textPrimary,
            textShadow: '0 1px 8px rgba(0,0,0,0.7)',
          }}>{name}</h3>

          {/* AI Analysis chips */}
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {quickAnalysis.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg backdrop-blur-md"
                style={{
                  background: ghostMode ? 'rgba(60,60,60,0.5)' : 'rgba(0,240,255,0.08)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : `${CYAN}22`}`,
                  boxShadow: ghostMode ? 'none' : `0 0 6px ${CYAN_DIM}0.06)`,
                }}
              >
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{
                  background: ghostMode ? 'rgba(160,160,160,0.4)' : CYAN,
                  boxShadow: ghostMode ? 'none' : `0 0 4px ${CYAN}60`,
                }} />
                <span className="text-[10px] font-mono font-medium" style={{
                  color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.88)',
                }}>{insight}</span>
              </motion.div>
            ))}
          </div>

          {/* AI attribution */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full flex items-center justify-center" style={{
              background: ghostMode ? 'rgba(160,160,160,0.15)' : `conic-gradient(from 135deg, ${PURPLE}, ${CYAN}, ${PURPLE})`,
            }}>
              <div className="w-[70%] h-[70%] rounded-full" style={{
                background: 'rgba(0,0,0,0.8)',
              }} />
            </div>
            <span className="text-[8px] font-mono uppercase tracking-[0.15em]" style={{
              color: ghostMode ? 'rgba(160,160,160,0.3)' : `${CYAN_DIM}0.45)`,
            }}>Vive AI Analysis</span>
          </div>
        </div>
      </div>

      {/* ── Compact Macro Summary Bar ── */}
      <div className="px-4 py-2.5" style={{
        background: ghostMode ? 'rgba(16,16,18,0.8)' : 'rgba(6,6,10,0.85)',
        borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${CYAN_DIM}0.08)`}`,
      }}>
        <div className="flex items-center justify-between">
          {/* Macros summary */}
          <div className="flex items-center gap-2.5">
            {calories !== undefined && (
              <span className="text-[12px] font-mono font-bold tabular-nums" style={{
                color: ghostMode ? 'rgba(200,200,200,0.6)' : accentColor,
              }}>{calories} kcal</span>
            )}
            {protein !== undefined && (
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md" style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : '#00F0FFCC',
                background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(0,240,255,0.06)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,240,255,0.1)'}`,
              }}>P:{protein}g</span>
            )}
            {carbs !== undefined && (
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md" style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : '#6B8AFFCC',
                background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(107,138,255,0.06)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(107,138,255,0.1)'}`,
              }}>C:{carbs}g</span>
            )}
            {fat !== undefined && (
              <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md" style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : '#FFB86BCC',
                background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,184,107,0.06)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,184,107,0.1)'}`,
              }}>F:{fat}g</span>
            )}
          </div>

          {/* Time + expand indicator */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tabular-nums tracking-wider" style={{
              color: textTertiary,
            }}>{time}</span>
            <motion.svg
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ opacity: 0.3 }}
            >
              <path d="M2 3.5L5 6.5L8 3.5" stroke={ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.4)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          </div>
        </div>

        {/* Expandable detail section */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 flex flex-col gap-2" style={{
                borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                {/* Macro bars */}
                {[
                  { label: 'Protein', value: protein || 0, max: 60, color: '#00F0FF' },
                  { label: 'Carbs', value: carbs || 0, max: 80, color: '#6B8AFF' },
                  { label: 'Fat', value: fat || 0, max: 40, color: '#FFB86B' },
                ].map((macro) => (
                  <div key={macro.label} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono w-12 text-right" style={{ color: textTertiary }}>{macro.label}</span>
                    <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{
                      background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.03)',
                    }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (macro.value / macro.max) * 100)}%` }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                          background: ghostMode ? 'rgba(160,160,160,0.25)' : `linear-gradient(90deg, ${macro.color}66, ${macro.color})`,
                          boxShadow: ghostMode ? 'none' : `0 0 6px ${macro.color}25`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold tabular-nums w-8 text-right" style={{
                      color: ghostMode ? 'rgba(160,160,160,0.5)' : `${macro.color}CC`,
                    }}>{macro.value}g</span>
                  </div>
                ))}

                {/* Full analysis list */}
                <div className="mt-1">
                  <span className="text-[8px] font-mono uppercase tracking-[0.15em] mb-1.5 block" style={{ color: textTertiary }}>
                    Full AI Analysis
                  </span>
                  {quickAnalysis.map((insight, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{
                        background: ghostMode ? 'rgba(160,160,160,0.3)' : CYAN,
                      }} />
                      <span className="text-[10px] font-mono" style={{ color: textSecondary }}>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom neon accent line */}
      {!ghostMode && (
        <div className="absolute bottom-0 left-0 right-0 h-[1px] z-30" style={{
          background: `linear-gradient(90deg, transparent 10%, ${CYAN}25 30%, ${CYAN}40 50%, ${CYAN}25 70%, transparent 90%)`,
        }} />
      )}
    </motion.div>
  );
}
