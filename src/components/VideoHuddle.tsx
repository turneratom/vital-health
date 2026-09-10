import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

const NEON = '#E8976C';
const NEON_GLOW = 'rgba(232,151,108,0.35)';

interface VideoHuddleProps {
  isOpen: boolean;
  onClose: () => void;
  peerCount: number;
  zoneColor?: string;
}

type HuddleState = 'connecting' | 'active' | 'error';

function VideoHuddleInner({ isOpen, onClose, peerCount, zoneColor = NEON }: VideoHuddleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<HuddleState>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());

  // Request camera on mount
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    startTimeRef.current = Date.now();
    setState('connecting');

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 320, facingMode: 'user' },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState('active');
      } catch {
        if (!cancelled) setState('error');
      }
    };

    initMedia();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // Elapsed timer
  useEffect(() => {
    if (!isOpen || state !== 'active') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, state]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setIsMuted((m) => !m);
  }, []);

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
    }
    setIsVideoOff((v) => !v);
  }, []);

  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState('connecting');
    setElapsed(0);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsExpanded(false);
    onClose();
  }, [onClose]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const bubbleSize = isExpanded ? 200 : 120;

  // Drag handling
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - bubbleSize - 20, dragStartRef.current.posX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - bubbleSize - 20, dragStartRef.current.posY + dy)),
    });
  }, [isDragging, bubbleSize]);

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dragRef}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 10000,
            width: bubbleSize,
            height: bubbleSize,
            touchAction: 'none',
            userSelect: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Outer glow ring */}
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, ${zoneColor}44, ${zoneColor}00, ${zoneColor}44, ${zoneColor}00, ${zoneColor}44)`,
              animation: 'huddle-ring-spin 4s linear infinite',
              opacity: state === 'active' ? 1 : 0.3,
              transition: 'opacity 0.5s',
            }}
          />

          {/* Main bubble container */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              overflow: 'hidden',
              border: `2px solid ${zoneColor}66`,
              background: '#0a0a0a',
              boxShadow: `0 0 30px ${zoneColor}33, 0 8px 32px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.5)`,
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
          >
            {/* Video element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: isVideoOff ? 'none' : 'block',
              }}
            />

            {/* Video off state */}
            {isVideoOff && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
                }}
              >
                <div
                  style={{
                    width: isExpanded ? 60 : 40,
                    height: isExpanded ? 60 : 40,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${zoneColor}44, ${zoneColor}22)`,
                    border: `1px solid ${zoneColor}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: isExpanded ? 24 : 16,
                  }}
                >
                  👤
                </div>
              </div>
            )}

            {/* Connecting state */}
            {state === 'connecting' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10,10,10,0.9)',
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    border: `2px solid ${zoneColor}33`,
                    borderTopColor: zoneColor,
                    borderRadius: '50%',
                    animation: 'huddle-spin 0.8s linear infinite',
                  }}
                />
                <span
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 9,
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  CONNECTING
                </span>
              </div>
            )}

            {/* Error state */}
            {state === 'error' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(10,10,10,0.95)',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 20 }}>📷</span>
                <span
                  style={{
                    color: '#D4847A',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    textAlign: 'center',
                    padding: '0 8px',
                  }}
                >
                  CAMERA ACCESS DENIED
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                  style={{
                    background: 'rgba(212,132,122,0.15)',
                    border: '1px solid rgba(212,132,122,0.3)',
                    color: '#D4847A',
                    fontSize: 8,
                    padding: '3px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  CLOSE
                </button>
              </div>
            )}

            {/* Top status bar */}
            {state === 'active' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '4px 0',
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
                }}
              >
                {/* Live indicator */}
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#30D158',
                    boxShadow: '0 0 6px #30D158',
                    animation: 'huddle-pulse 2s ease-in-out infinite',
                  }}
                />
                <span
                  style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 8,
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                  }}
                >
                  {formatTime(elapsed)}
                </span>
                {peerCount > 0 && (
                  <span
                    style={{
                      color: zoneColor,
                      fontSize: 8,
                      fontFamily: 'monospace',
                    }}
                  >
                    +{peerCount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Control buttons — positioned below the bubble */}
          {state === 'active' && (
            <div
              style={{
                position: 'absolute',
                bottom: -36,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 4,
                pointerEvents: 'auto',
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Mute */}
              <button
                onClick={toggleMute}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `1px solid ${isMuted ? 'rgba(212,132,122,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  background: isMuted ? 'rgba(212,132,122,0.15)' : 'rgba(255,255,255,0.06)',
                  color: isMuted ? '#D4847A' : 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s',
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? '🔇' : '🎙️'}
              </button>

              {/* Video toggle */}
              <button
                onClick={toggleVideo}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `1px solid ${isVideoOff ? 'rgba(212,132,122,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  background: isVideoOff ? 'rgba(212,132,122,0.15)' : 'rgba(255,255,255,0.06)',
                  color: isVideoOff ? '#D4847A' : 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s',
                }}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
              >
                {isVideoOff ? '🚫' : '📷'}
              </button>

              {/* Expand/collapse */}
              <button
                onClick={() => setIsExpanded((e) => !e)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s',
                }}
                title={isExpanded ? 'Shrink' : 'Expand'}
              >
                {isExpanded ? '⬇' : '⬆'}
              </button>

              {/* End call */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1px solid rgba(255,59,48,0.4)',
                  background: 'rgba(255,59,48,0.2)',
                  color: '#FF3B30',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s',
                }}
                title="End huddle"
              >
                ✖
              </button>
            </div>
          )}

          {/* CSS animations */}
          <style>{`
            @keyframes huddle-ring-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes huddle-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes huddle-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const VideoHuddle = memo(VideoHuddleInner);

/* ══════════════════════════════════════════════════════════════ */
/* ── Huddle Trigger Button (rendered inside FluidCanvas overlay) */
/* ══════════════════════════════════════════════════════════════ */

interface HuddleTriggerProps {
  x: number;
  y: number;
  intensity: number;
  color: string;
  onOpen: () => void;
  isHuddleActive: boolean;
}

export function HuddleTrigger({ x, y, intensity, color, onOpen, isHuddleActive }: HuddleTriggerProps) {
  if (intensity < 0.35 || isHuddleActive) return null;

  const breathe = 0.85 + 0.15 * Math.sin(Date.now() * 0.003);
  const alpha = Math.min(1, (intensity - 0.35) / 0.65);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: alpha, scale: breathe }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'fixed',
        left: x - 52,
        top: y - 14,
        zIndex: 9999,
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={onOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 20,
          border: `1px solid ${color}55`,
          background: `rgba(10,10,10,0.85)`,
          backdropFilter: 'blur(16px)',
          cursor: 'pointer',
          boxShadow: `0 0 20px ${color}22, 0 4px 16px rgba(0,0,0,0.5)`,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${color}44, 0 4px 20px rgba(0,0,0,0.6)`;
          (e.currentTarget as HTMLElement).style.borderColor = `${color}88`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${color}22, 0 4px 16px rgba(0,0,0,0.5)`;
          (e.currentTarget as HTMLElement).style.borderColor = `${color}55`;
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
            animation: 'huddle-pulse 1.5s ease-in-out infinite',
          }}
        />
        <span
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 10,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          Open Huddle
        </span>
        <span style={{ fontSize: 12 }}>🎥</span>
      </button>
    </motion.div>
  );
}
