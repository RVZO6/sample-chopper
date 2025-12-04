import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDrag, usePinch } from '@use-gesture/react';
import { useAudio, useAudioTime } from '@/context/AudioContext';

// ============================================================================
// Configuration
// ============================================================================
//
// TODO: Firefox shows occasional stutter/lag compared to Chrome/Safari.
// Current Canvas2D optimizations help but don't fully resolve it.
// Consider migrating to WebGL renderer if Firefox performance is critical.
// See: https://github.com/nicbarker/clay (WebGL 2D rendering library)

const CONFIG = {
  /** Enable momentum scrolling after drag release */
  ENABLE_MOMENTUM: false,
  /** Minimum pixels between time tick labels */
  MIN_TICK_SPACING: 60,
  /** Background color matching app theme */
  BACKGROUND_COLOR: '#1e1e1e',
  /** Maximum zoom level (pixels per second) */
  MAX_ZOOM: 1000,
  /** Minimum zoom level (pixels per second) */
  MIN_ZOOM: 10,
  /** LOD levels configuration: [peaksPerSecond] from lowest to highest detail */
  LOD_LEVELS: [25, 50, 100, 200, 400],
} as const;

// Color map for cue point flags - matches rainbow gradient
const FLAG_COLOR_MAP: Record<string, string> = {
  // Row 1 - Reds to Oranges
  'bg-red-600': '#dc2626',
  'bg-red-500': '#ef4444',
  'bg-orange-600': '#ea580c',
  'bg-orange-500': '#f97316',
  'bg-amber-500': '#f59e0b',
  // Row 2 - Yellows to Greens
  'bg-yellow-500': '#eab308',
  'bg-lime-500': '#84cc16',
  'bg-green-500': '#22c55e',
  'bg-emerald-500': '#10b981',
  'bg-teal-500': '#14b8a6',
  // Row 3 - Teals to Blues
  'bg-cyan-500': '#06b6d4',
  'bg-sky-500': '#0ea5e9',
  'bg-blue-500': '#3b82f6',
  'bg-indigo-500': '#6366f1',
  'bg-violet-500': '#8b5cf6',
  // Row 4 - Purples to Pinks
  'bg-purple-500': '#a855f7',
  'bg-fuchsia-500': '#d946ef',
  'bg-pink-500': '#ec4899',
  'bg-rose-500': '#f43f5e',
  'bg-red-400': '#f87171',
};

// Time tick intervals in seconds
const TICK_INTERVALS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];

// ============================================================================
// LOD Peak Data Structure
// ============================================================================

interface LODPeaks {
  /** Peaks per second for this LOD level */
  peaksPerSecond: number;
  /** The peak data */
  peaks: number[];
}

interface PeakData {
  /** All LOD levels, sorted from lowest to highest detail */
  levels: LODPeaks[];
  /** Whether all levels have been computed */
  isComplete: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const WaveformDisplay: React.FC = () => {
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Audio context
  const currentTime = useAudioTime();
  const { audioEngine, duration, seek, play, pause, isPlaying, pads, setPadCuePoint } = useAudio();

  // State
  const [peakData, setPeakData] = useState<PeakData>({ levels: [], isComplete: false });
  const [zoom, setZoom] = useState(100); // Pixels per second
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Drag state for gestures
  const dragStartTimeRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Flag dragging state
  const [draggingFlagId, setDraggingFlagId] = useState<string | null>(null);
  const flagDragStartX = useRef(0);
  const flagDragStartTime = useRef(0);

  // Cache gradient to avoid recreating every frame
  const gradientRef = useRef<CanvasGradient | null>(null);
  const lastHeightRef = useRef(0);

  // Calculate minimum zoom based on container width and duration
  const minZoom = useMemo(() => {
    if (duration <= 0 || dimensions.width <= 0) return CONFIG.MIN_ZOOM;
    return Math.max(CONFIG.MIN_ZOOM, (dimensions.width * 0.9) / duration);
  }, [duration, dimensions.width]);

  // ============================================================================
  // Select Best LOD Level for Current Zoom
  // ============================================================================

  const selectedLOD = useMemo((): LODPeaks | null => {
    if (peakData.levels.length === 0) return null;

    // Calculate how many peaks per pixel we want (aim for ~1 peak per 2 pixels)
    const idealPeaksPerSecond = zoom / 2;

    // Find the smallest LOD that has enough detail
    // (first one with peaksPerSecond >= ideal, or the highest available)
    for (const level of peakData.levels) {
      if (level.peaksPerSecond >= idealPeaksPerSecond) {
        return level;
      }
    }

    // If no level has enough detail, use the highest available
    return peakData.levels[peakData.levels.length - 1];
  }, [peakData.levels, zoom]);

  // ============================================================================
  // Resize Observer
  // ============================================================================

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

  // ============================================================================
  // Wheel Zoom with AbortController
  // ============================================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = new AbortController();

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
      }

      const scale = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(minZoom, Math.min(CONFIG.MAX_ZOOM, z * scale)));
    };

    container.addEventListener('wheel', handleWheel, {
      passive: false,
      signal: controller.signal
    });

    return () => controller.abort();
  }, [minZoom]);

  // ============================================================================
  // Spacebar Play/Pause
  // ============================================================================

  useEffect(() => {
    const controller = new AbortController();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { signal: controller.signal });
    return () => controller.abort();
  }, [isPlaying, play, pause]);

  // ============================================================================
  // Progressive LOD Peak Loading
  // ============================================================================

  useEffect(() => {
    if (duration <= 0) return;

    const audioBuffer = audioEngine.getAudioBuffer();
    if (!audioBuffer) {
      console.warn('[WaveformDisplay] No audio buffer available');
      return;
    }

    // Reset peak data for new audio
    setPeakData({ levels: [], isComplete: false });

    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const sampleRate = audioBuffer.sampleRate;

    // Compute LOD levels progressively, starting from lowest (fastest)
    let currentLevelIndex = 0;
    const computedLevels: LODPeaks[] = [];

    const computeNextLevel = () => {
      if (currentLevelIndex >= CONFIG.LOD_LEVELS.length) {
        // All levels computed
        setPeakData({ levels: computedLevels, isComplete: true });
        return;
      }

      const peaksPerSecond = CONFIG.LOD_LEVELS[currentLevelIndex];
      const targetPeakCount = Math.ceil(duration * peaksPerSecond);

      // Compute peaks for this level
      const peaks = computePeaksFromSamples(channelData, totalSamples, targetPeakCount);

      computedLevels.push({ peaksPerSecond, peaks });

      // Update state with new level (triggers re-render)
      setPeakData({ levels: [...computedLevels], isComplete: false });

      currentLevelIndex++;

      // Schedule next level computation (yields to UI)
      setTimeout(computeNextLevel, 0);
    };

    // Start progressive loading
    computeNextLevel();

  }, [duration, audioEngine]);

  // ============================================================================
  // Peak Computation Helper
  // ============================================================================

  /**
   * Compute peaks using precise floating-point sample positions.
   * This ensures that peak index `i` maps to the exact same time position
   * across all LOD levels, preventing visual drift when switching detail levels.
   */
  function computePeaksFromSamples(
    channelData: Float32Array,
    totalSamples: number,
    targetPeakCount: number
  ): number[] {
    const peaks: number[] = new Array(targetPeakCount);

    // Use floating-point ratio for precise time alignment across LOD levels
    // This ensures peak[i] always represents the exact same time window
    // regardless of the LOD level's peaksPerSecond value
    const samplesPerPeak = totalSamples / targetPeakCount;

    for (let i = 0; i < targetPeakCount; i++) {
      // Use precise floating-point boundaries, then floor/ceil for iteration
      const start = Math.floor(i * samplesPerPeak);
      const end = Math.min(Math.floor((i + 1) * samplesPerPeak), totalSamples);

      let max = 0;
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > max) max = abs;
      }
      peaks[i] = max;
    }

    return peaks;
  }

  // ============================================================================
  // Main Draw Loop
  // ============================================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Cache context with Firefox-friendly options
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext('2d', {
        alpha: false,           // No transparency needed, faster compositing
        desynchronized: true,   // Reduce latency (hint, may be ignored)
      });
    }
    const ctx = ctxRef.current;
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    // Handle High DPI
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gradientRef.current = null;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear with background
    ctx.fillStyle = CONFIG.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    if (!selectedLOD) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LOADING / NO AUDIO', width / 2, height / 2);
      return;
    }

    const { peaks, peaksPerSecond } = selectedLOD;
    const centerX = width / 2;
    const pixelsPerSecond = zoom;
    const currentPixel = currentTime * pixelsPerSecond;
    const startX = centerX - currentPixel;

    // Calculate visible range
    const visibleStartTime = Math.max(0, (currentPixel - centerX) / pixelsPerSecond);
    const visibleEndTime = Math.min(duration, (currentPixel + centerX) / pixelsPerSecond);

    const startPeakIndex = Math.max(0, Math.floor(visibleStartTime * peaksPerSecond));
    const endPeakIndex = Math.min(peaks.length, Math.ceil(visibleEndTime * peaksPerSecond));

    // Cache gradient
    if (!gradientRef.current || lastHeightRef.current !== height) {
      gradientRef.current = ctx.createLinearGradient(0, 0, 0, height);
      gradientRef.current.addColorStop(0, '#fb923c');
      gradientRef.current.addColorStop(0.3, '#fbbf24');
      gradientRef.current.addColorStop(0.7, '#fbbf24');
      gradientRef.current.addColorStop(1, '#fb923c');
      lastHeightRef.current = height;
    }

    // Draw waveform - NO SKIPPING, LOD handles density
    ctx.lineWidth = 2;
    ctx.strokeStyle = gradientRef.current;
    ctx.beginPath();

    // Pre-calculate constants outside loop (helps Firefox JIT)
    const heightScale = height * 0.8;
    const halfHeight = height / 2;
    const pps = peaksPerSecond; // Local var faster than property access

    for (let i = startPeakIndex; i < endPeakIndex; i++) {
      const h = peaks[i] * heightScale;
      const x = startX + (i / pps) * pixelsPerSecond;
      const y = halfHeight - h / 2;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
    }
    ctx.stroke();

    // Draw Cue Point Flags
    pads.forEach(pad => {
      if (pad.cuePoint === null) return;

      const padPixel = pad.cuePoint * pixelsPerSecond;
      const x = startX + padPixel;

      if (x < -20 || x > width + 20) return;

      const flagColor = FLAG_COLOR_MAP[pad.color] || '#ffffff';

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.strokeStyle = flagColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = flagColor;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 12, 0);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();

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

    const idealSecondsPerTick = CONFIG.MIN_TICK_SPACING / pixelsPerSecond;
    const tickInterval = TICK_INTERVALS.find(i => i >= idealSecondsPerTick) || 300;

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

    // Draw Center Playhead (avoid save/restore for Firefox perf)
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    // Reset shadow (cheaper than save/restore)
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

  }, [selectedLOD, zoom, currentTime, duration, dimensions, pads]);

  // ============================================================================
  // Gesture Handlers
  // ============================================================================

  const bindDrag = useDrag(
    ({ first, active, movement: [mx], tap, event }) => {
      if (draggingFlagId) return;

      if (first) {
        dragStartTimeRef.current = currentTime;
        setIsDragging(true);
      }

      if (active && !tap) {
        const dt = -mx / zoom;
        const newTime = Math.max(0, Math.min(duration, dragStartTimeRef.current + dt));
        seek(newTime);
      }

      if (!active) {
        setIsDragging(false);

        if (tap && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const clientX = (event as MouseEvent).clientX;
          const clickX = clientX - rect.left;
          const centerX = rect.width / 2;
          const pixelsFromCenter = clickX - centerX;
          const timeOffset = pixelsFromCenter / zoom;
          const clickedTime = currentTime + timeOffset;
          const newTime = Math.max(0, Math.min(duration, clickedTime));
          seek(newTime);
        }
      }
    },
    {
      pointer: { touch: true },
      filterTaps: true,
    }
  );

  const bindPinch = usePinch(
    ({ offset: [scale] }) => {
      const baseZoom = 100;
      setZoom(Math.max(minZoom, Math.min(CONFIG.MAX_ZOOM, baseZoom * scale)));
    },
    {
      scaleBounds: { min: minZoom / 100, max: CONFIG.MAX_ZOOM / 100 },
    }
  );

  const gestureBindings = {
    ...bindDrag(),
    ...bindPinch(),
  };

  // ============================================================================
  // Flag Drag Handlers
  // ============================================================================

  const handleFlagMouseDown = useCallback((padId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const pad = pads.find(p => p.id === padId);
    if (!pad || pad.cuePoint === null) return;

    setDraggingFlagId(padId);
    flagDragStartX.current = e.clientX;
    flagDragStartTime.current = pad.cuePoint;
  }, [pads]);

  const handleFlagMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingFlagId) return;

    const deltaX = e.clientX - flagDragStartX.current;
    const deltaTime = deltaX / zoom;
    const newTime = Math.max(0, Math.min(duration, flagDragStartTime.current + deltaTime));

    setPadCuePoint(draggingFlagId, newTime);
  }, [draggingFlagId, zoom, duration, setPadCuePoint]);

  const handleFlagMouseUp = useCallback(() => {
    setDraggingFlagId(null);
  }, []);

  useEffect(() => {
    if (!draggingFlagId) return;

    const controller = new AbortController();

    window.addEventListener('mouseup', handleFlagMouseUp, { signal: controller.signal });
    window.addEventListener('mousemove', (e) => {
      const deltaX = e.clientX - flagDragStartX.current;
      const deltaTime = deltaX / zoom;
      const newTime = Math.max(0, Math.min(duration, flagDragStartTime.current + deltaTime));
      setPadCuePoint(draggingFlagId, newTime);
    }, { signal: controller.signal });

    return () => controller.abort();
  }, [draggingFlagId, zoom, duration, setPadCuePoint, handleFlagMouseUp]);

  // ============================================================================
  // Render
  // ============================================================================

  // Memoize visible flag positions to avoid inline calculations on each render
  const visibleFlags = useMemo(() => {
    if (dimensions.width <= 0) return [];

    const centerX = dimensions.width / 2;
    const currentPixel = currentTime * zoom;
    const startX = centerX - currentPixel;

    return pads
      .filter(pad => pad.cuePoint !== null)
      .map(pad => {
        const padPixel = pad.cuePoint! * zoom;
        const x = startX + padPixel;
        return { pad, x };
      })
      .filter(({ x }) => x >= -20 && x <= dimensions.width + 20);
  }, [pads, zoom, currentTime, dimensions.width]);

  const cursorStyle = useMemo(() => {
    if (draggingFlagId) return 'ew-resize';
    if (isDragging) return 'grabbing';
    return 'crosshair';
  }, [draggingFlagId, isDragging]);

  return (
    <div
      ref={containerRef}
      className="h-64 bg-surface-dark rounded-sm relative shadow-ui-element-inset overflow-hidden border border-black/50 touch-none"
      {...gestureBindings}
      onMouseMove={draggingFlagId ? handleFlagMouseMove : undefined}
      style={{ cursor: cursorStyle }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ willChange: 'contents' }}  // GPU compositing hint
      />



      {/* Interactive Flag Overlays - positions memoized */}
      {visibleFlags.map(({ pad, x }) => (
        <React.Fragment key={pad.id}>
          <div
            onMouseDown={(e) => handleFlagMouseDown(pad.id, e)}
            className="absolute cursor-ew-resize hover:opacity-50"
            style={{
              left: `${x - 6}px`,
              top: 0,
              width: '20px',
              height: '20px',
              pointerEvents: 'auto'
            }}
            title={`Drag to reposition ${pad.label}`}
          />
          <div
            onMouseDown={(e) => handleFlagMouseDown(pad.id, e)}
            className="absolute cursor-ew-resize hover:opacity-50"
            style={{
              left: `${x - 6}px`,
              bottom: 0,
              width: '20px',
              height: '20px',
              pointerEvents: 'auto'
            }}
            title={`Drag to reposition ${pad.label}`}
          />
        </React.Fragment>
      ))}
    </div>
  );
};
