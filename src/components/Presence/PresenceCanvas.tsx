import { useRef, useEffect, useCallback } from 'react';
import type { TrailPoint } from './usePresenceState';

interface RemoteUser {
  sessionId: string;
  x: number;
  y: number;
  ghostMode: boolean;
  color: string;
}

interface TrailPointWithOpacity extends TrailPoint {
  opacity: number;
}

interface PresenceCanvasProps {
  points: TrailPointWithOpacity[];
  x: number;
  y: number;
  ghostMode: boolean;
  remoteUsers?: RemoteUser[];
}

const LOCAL_COLOR = '#00FFCC';

export function PresenceCanvas({ points, x, y, ghostMode, remoteUsers = [] }: PresenceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dprRef = useRef(Math.min(window.devicePixelRatio || 1, 2));

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = dprRef.current;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = dprRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const globalAlpha = ghostMode ? 0.3 : 1;

    // Draw local trail
    drawTrail(ctx, points, LOCAL_COLOR, globalAlpha, ghostMode);

    // Draw cursor head
    if (x > 0 && y > 0) {
      drawCursorHead(ctx, x, y, LOCAL_COLOR, globalAlpha);
    }

    // Draw remote user trails
    for (const remote of remoteUsers) {
      const remoteAlpha = remote.ghostMode ? 0.25 : 0.6;
      drawRemoteCursor(ctx, remote.x, remote.y, remote.color, remoteAlpha);
    }
  }, [points, x, y, ghostMode, remoteUsers]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 50 }}
    />
  );
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: TrailPointWithOpacity[],
  color: string,
  globalAlpha: number,
  ghostMode: boolean
) {
  if (points.length < 2) return;

  // Wide soft glow pass
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Pass 1: Wide glow
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.strokeStyle = hexToRgba(color, 0.08 * globalAlpha);
  ctx.lineWidth = 28;
  ctx.filter = 'blur(12px)';
  ctx.stroke();
  ctx.filter = 'none';

  // Pass 2: Medium glow
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  ctx.lineTo(last.x, last.y);
  ctx.strokeStyle = hexToRgba(color, 0.2 * globalAlpha);
  ctx.lineWidth = 10;
  ctx.filter = 'blur(4px)';
  ctx.stroke();
  ctx.filter = 'none';

  // Pass 3: Sharp core
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  ctx.lineTo(last.x, last.y);
  ctx.strokeStyle = hexToRgba(color, 0.6 * globalAlpha);
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw individual trail dots with decay
  for (const point of points) {
    const alpha = point.opacity * globalAlpha;
    if (alpha < 0.01) continue;

    const radius = ghostMode ? 2 + point.opacity * 2 : 2 + point.opacity * 3;

    // Dot glow
    const grad = ctx.createRadialGradient(
      point.x, point.y, 0,
      point.x, point.y, radius * 4
    );
    grad.addColorStop(0, hexToRgba(color, alpha * 0.5));
    grad.addColorStop(0.5, hexToRgba(color, alpha * 0.15));
    grad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 4, 0, Math.PI * 2);
    ctx.fill();

    // Dot core
    ctx.fillStyle = hexToRgba('#ffffff', alpha * 0.8);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCursorHead(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
  globalAlpha: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Outer ambient glow
  const outerGrad = ctx.createRadialGradient(x, y, 0, x, y, 40);
  outerGrad.addColorStop(0, hexToRgba(color, 0.15 * globalAlpha));
  outerGrad.addColorStop(0.5, hexToRgba(color, 0.05 * globalAlpha));
  outerGrad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(x, y, 40, 0, Math.PI * 2);
  ctx.fill();

  // Mid glow
  const midGrad = ctx.createRadialGradient(x, y, 0, x, y, 14);
  midGrad.addColorStop(0, hexToRgba(color, 0.6 * globalAlpha));
  midGrad.addColorStop(0.6, hexToRgba(color, 0.2 * globalAlpha));
  midGrad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = midGrad;
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();

  // Core bright dot
  ctx.fillStyle = hexToRgba('#ffffff', 0.9 * globalAlpha);
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRemoteCursor(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string,
  alpha: number
) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Outer glow
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 24);
  grad.addColorStop(0, hexToRgba(color, 0.4 * alpha));
  grad.addColorStop(0.5, hexToRgba(color, 0.1 * alpha));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.fillStyle = hexToRgba(color, 0.8 * alpha);
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();

  // White center
  ctx.fillStyle = hexToRgba('#ffffff', 0.6 * alpha);
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
