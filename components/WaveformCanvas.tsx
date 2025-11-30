import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext';

export const WaveformCanvas: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { audioEngine, currentTime, duration, seek } = useAudio();
    const [peaks, setPeaks] = useState<number[]>([]);
    const [zoom, setZoom] = useState(100); // Pixels per second

    // Load peaks when audio is ready
    useEffect(() => {
        if (duration > 0) {
            // Generate enough peaks for a detailed view
            // For simplicity, let's generate 1 peak per pixel at max zoom
            // or a fixed high resolution set.
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

        // Clear
        ctx.fillStyle = '#1f2937'; // gray-800 background
        ctx.fillRect(0, 0, width, height);

        if (peaks.length === 0) {
            ctx.fillStyle = '#6b7280';
            ctx.font = '14px monospace';
            ctx.fillText('LOADING / NO AUDIO', width / 2 - 60, height / 2);
            return;
        }

        // Drawing Logic
        // We want 'currentTime' to be at 'width / 2'
        const centerX = width / 2;
        const pixelsPerSecond = zoom;
        const currentPixel = currentTime * pixelsPerSecond;

        // Translate so 0 time is at (centerX - currentPixel)
        const startX = centerX - currentPixel;

        ctx.beginPath();
        ctx.strokeStyle = '#6b7280'; // gray-500
        ctx.lineWidth = 2;

        // We only need to draw visible peaks
        // Visible range in pixels: [0, width]
        // In time: [-startX / zoom, (width - startX) / zoom]
        // But we have pre-calculated peaks. 
        // Let's map peaks to time.
        // peaks array maps to [0, duration]

        const peaksPerSecond = peaks.length / duration;

        // Optimization: Draw only visible range
        // Visible start time
        const visibleStartTime = Math.max(0, (currentPixel - centerX) / pixelsPerSecond);
        const visibleEndTime = Math.min(duration, (currentPixel + centerX) / pixelsPerSecond);

        const startPeakIndex = Math.floor(visibleStartTime * peaksPerSecond);
        const endPeakIndex = Math.ceil(visibleEndTime * peaksPerSecond);

        for (let i = startPeakIndex; i < endPeakIndex; i++) {
            const peak = peaks[i];
            const time = i / peaksPerSecond;
            const x = startX + (time * pixelsPerSecond);

            const h = peak * (height * 0.8); // 80% height
            const y = (height - h) / 2;

            ctx.moveTo(x, y);
            ctx.lineTo(x, y + h);
        }
        ctx.stroke();

        // Draw Center Caret
        ctx.beginPath();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.stroke();

        // Draw Time Ticks (Bottom)
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';

        const tickInterval = 1; // 1 second
        const startTick = Math.floor(visibleStartTime);
        const endTick = Math.ceil(visibleEndTime);

        for (let t = startTick; t <= endTick; t++) {
            const x = startX + (t * pixelsPerSecond);
            ctx.fillRect(x - 1, height - 10, 2, 10);
            ctx.fillText(t.toFixed(1) + 's', x, height - 14);
        }

    }, [peaks, zoom, currentTime, duration]);

    // Interaction
    const isDragging = useRef(false);
    const lastX = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        lastX.current = e.clientX;
        document.body.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;

        const deltaX = e.clientX - lastX.current;
        lastX.current = e.clientX;

        // Dragging RIGHT moves audio RIGHT, which means we are going BACK in time.
        // So deltaX > 0 -> decrease time
        const dt = -deltaX / zoom;
        const newTime = Math.max(0, Math.min(duration, currentTime + dt));
        seek(newTime);
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = 'default';
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Zoom
        const scale = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(10, Math.min(1000, z * scale)));
    };

    return (
        <div
            ref={containerRef}
            className="h-64 bg-surface-dark rounded relative shadow-ui-element-inset overflow-hidden cursor-grab active:cursor-grabbing border border-black/50"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Zoom Controls Overlay */}
            <div className="absolute top-4 left-4 flex flex-col bg-black/80 backdrop-blur rounded-md border border-white/20 shadow-lg z-30 pointer-events-auto">
                <button
                    className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-t transition-colors active:bg-white/20"
                    onClick={() => setZoom(z => Math.min(1000, z * 1.5))}
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
