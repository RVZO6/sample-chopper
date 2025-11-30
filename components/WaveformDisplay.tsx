import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext';

export const WaveformDisplay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { audioEngine, currentTime, duration, seek, play, pause, isPlaying, pads } = useAudio();
  const [peaks, setPeaks] = useState<number[]>([]);
  const [zoom, setZoom] = useState(100); // Pixels per second
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle Wheel (Zoom) with non-passive listener to prevent browser zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Zoom with bounds
      const scale = e.deltaY > 0 ? 0.9 : 1.1;

      // Calculate minimum zoom (entire waveform fits in viewport)
      const containerWidth = container.clientWidth || 800;
      const minZoom = duration > 0 ? (containerWidth * 0.9) / duration : 10;

      setZoom(z => Math.max(minZoom, Math.min(1000, z * scale)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [duration]); // Re-bind if duration changes (unlikely to change often during play)

  // Spacebar play/pause - works for both global and pad playback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          // Stop any playback (pad or global) and reset to global mode
          pause();
        } else {
          // Start global mode playback (no pad settings)
          play();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, play, pause]);

  // Load peaks when audio is ready
  useEffect(() => {
    if (duration > 0) {
      const width = Math.ceil(duration * 200); // 200 peaks per second
      const p = audioEngine.getPeaks(width);
      setPeaks(p);
    }
  }, [duration, audioEngine]);

  // Draw Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Handle High DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Clear with app's surface-dark background
    ctx.fillStyle = '#1e1e1e'; // surface-dark to match app
    ctx.fillRect(0, 0, width, height);

    if (peaks.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px monospace';
      ctx.fillText('LOADING / NO AUDIO', width / 2 - 60, height / 2);
      return;
    }

    // Drawing Logic
    const centerX = width / 2;
    const pixelsPerSecond = zoom;
    const currentPixel = currentTime * pixelsPerSecond;
    const startX = centerX - currentPixel;
    const peaksPerSecond = peaks.length / duration;

    // Optimization: Draw only visible range
    const visibleStartTime = Math.max(0, (currentPixel - centerX) / pixelsPerSecond);
    const visibleEndTime = Math.min(duration, (currentPixel + centerX) / pixelsPerSecond);

    const startPeakIndex = Math.floor(visibleStartTime * peaksPerSecond);
    const endPeakIndex = Math.ceil(visibleEndTime * peaksPerSecond);

    // Draw waveform with yellow/amber gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#fb923c');    // orange-400
    gradient.addColorStop(0.3, '#fbbf24');  // amber-400 (primary)
    gradient.addColorStop(0.5, '#fbbf24');  // amber-400 (primary)
    gradient.addColorStop(0.7, '#fbbf24');  // amber-400 (primary)
    gradient.addColorStop(1, '#fb923c');    // orange-400

    ctx.lineWidth = 2;

    for (let i = startPeakIndex; i < endPeakIndex; i++) {
      const peak = peaks[i];
      const time = i / peaksPerSecond;
      const x = startX + (time * pixelsPerSecond);

      const h = peak * (height * 0.8);
      const y = (height - h) / 2;

      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }

    // Draw Cue Point Flags
    pads.forEach(pad => {
      if (pad.cuePoint === null) return;

      const padPixel = pad.cuePoint * pixelsPerSecond;
      const x = startX + padPixel;

      // Only draw if visible
      if (x < -20 || x > width + 20) return;

      // Get Color
      const colorMap: Record<string, string> = {
        'bg-red-700': '#b91c1c',
        'bg-yellow-600': '#ca8a04',
        'bg-fuchsia-700': '#a21caf',
        'bg-orange-600': '#ea580c',
        'bg-green-600': '#16a34a',
        'bg-yellow-500': '#eab308',
        'bg-red-800': '#991b1b',
        'bg-green-700': '#15803d',
        'bg-surface-dark': '#1e1e1e',
        'bg-red-600': '#dc2626',
        'bg-green-500': '#22c55e',
        'bg-red-900': '#7f1d1d',
      };

      const flagColor = colorMap[pad.color] || '#ffffff';

      // Draw Flag Line (Stick)
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.strokeStyle = flagColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Flag Triangle (Top)
      ctx.fillStyle = flagColor;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();

      // Draw Flag Triangle (Bottom)
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + 12, height);
      ctx.lineTo(x, height - 12);
      ctx.closePath();
      ctx.fill();
    });

    // Draw Time Ticks
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    let tickInterval: number;
    const minPixelsBetweenTicks = 60;
    const idealSecondsPerTick = minPixelsBetweenTicks / pixelsPerSecond;
    const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    tickInterval = intervals.find(i => i >= idealSecondsPerTick) || 300;

    const startTick = Math.floor(visibleStartTime / tickInterval) * tickInterval;
    const endTick = Math.ceil(visibleEndTime / tickInterval) * tickInterval;

    for (let t = startTick; t <= endTick; t += tickInterval) {
      const x = startX + (t * pixelsPerSecond);
      ctx.fillRect(x - 1, height - 10, 2, 10);
      const timeStr = tickInterval >= 60
        ? `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`
        : `${t.toFixed(tickInterval < 1 ? 1 : 0)}s`;
      ctx.fillText(timeStr, x, height - 14);
    }

    // Draw Center Caret LAST (on top of everything - thick white line with glow)
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.restore();

  }, [peaks, zoom, currentTime, duration, dimensions, pads]);

  // Interaction
  const isDragging = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const hasDragged = useRef(false);
  const lastX = useRef(0);

  // Global mouse up
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        setIsDraggingState(false);
        document.body.style.cursor = 'default';
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    setIsDraggingState(true);
    hasDragged.current = false;
    lastX.current = e.clientX;
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - lastX.current;
    if (Math.abs(deltaX) > 2) {
      hasDragged.current = true;
    }
    lastX.current = e.clientX;
    const dt = -deltaX / zoom;
    const newTime = Math.max(0, Math.min(duration, currentTime + dt));
    seek(newTime);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setIsDraggingState(false);
    document.body.style.cursor = 'default';
  };

  // Click to seek (only if not dragging)
  const handleClick = (e: React.MouseEvent) => {
    // Only seek if user didn't drag
    if (hasDragged.current) {
      hasDragged.current = false;
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const centerX = rect.width / 2;

    // Calculate time based on click position relative to center
    const pixelsFromCenter = clickX - centerX;
    const timeOffset = pixelsFromCenter / zoom;
    const clickedTime = currentTime + timeOffset;

    // Seek to clicked position
    const newTime = Math.max(0, Math.min(duration, clickedTime));
    seek(newTime);
  };

  return (
    <div
      ref={containerRef}
      className="h-64 bg-surface-dark rounded relative shadow-ui-element-inset overflow-hidden border border-black/50"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      style={{ cursor: isDraggingState ? 'grabbing' : 'crosshair' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Zoom Controls Overlay */}
      <div className="absolute top-3 right-3 flex flex-col bg-surface-dark/80 backdrop-blur-sm rounded border border-white/10 shadow-lg overflow-hidden">
        <button
          className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-t transition-colors active:bg-white/20"
          onClick={() => setZoom(z => Math.min(1000, z * 1.4))}
          title="Zoom In"
        >
          <span className="material-symbols-outlined text-sm">add</span>
        </button>
        <div className="w-full h-px bg-white/10"></div>
        <button
          className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-b transition-colors active:bg-white/20"
          onClick={() => setZoom(z => Math.max(10, z * 0.7))}
          title="Zoom Out"
        >
          <span className="material-symbols-outlined text-sm">remove</span>
        </button>
      </div>
    </div>
  );
};
